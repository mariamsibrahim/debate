import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import {
  DebateFormat,
  DebateSide,
  FORMAT_PHASES,
  ModeratorFlagPayload,
  PhaseDefinition,
  WebRTCSignalPayload,
} from "@debate/shared";
import { authenticateSocket } from "../common/socket-auth.util";
import { AuthenticatedUser } from "../common/guards/jwt-auth.guard";
import { DebatesService } from "./debates.service";
import { ModeratorService } from "../ai/moderator.service";
import { JudgeService } from "../ai/judge.service";
import { DebaterService } from "../ai/debater.service";
import { RatingsService } from "../ratings/ratings.service";

interface RuntimeParticipant {
  userId: string;
  username: string;
  side: DebateSide;
}

interface DebateRuntime {
  topicTitle: string;
  format: DebateFormat;
  phases: PhaseDefinition[];
  phaseIndex: number;
  phaseTimer: NodeJS.Timeout | null;
  participants: RuntimeParticipant[];
  transcript: { senderId: string; side: DebateSide; body: string }[];
  status: "ACTIVE" | "COMPLETED";
  /** Set when this debate's opponent is the AI practice partner (blueprint §28). */
  aiUserId?: string;
  /** Which phaseIndex the AI has already taken its one dedicated-turn shot in, to avoid double-firing. */
  aiRespondedPhaseIndex: number;
}

function randomDelayMs(minMs: number, maxMs: number) {
  return minMs + Math.floor(Math.random() * (maxMs - minMs));
}

/**
 * The real-time debate engine (blueprint §7-8): a server-authoritative
 * state machine over the phases in FORMAT_PHASES. The clock, turn-taking,
 * and transcript are all decided here — never by either client — which is
 * what makes the AI Judge's scorecard and the resulting Elo change
 * trustworthy. The AI Moderator (moderator.service.ts) only annotates the
 * transcript; it never controls timing or blocks a message.
 */
@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" } })
export class DebatesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(DebatesGateway.name);
  private readonly runtimes = new Map<string, DebateRuntime>();
  private readonly socketsByUser = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly debatesService: DebatesService,
    private readonly moderator: ModeratorService,
    private readonly judge: JudgeService,
    private readonly debater: DebaterService,
    private readonly ratings: RatingsService,
  ) {}

  handleConnection(client: Socket) {
    const user = authenticateSocket(client, this.jwt);
    if (!user) return;
    client.data.user = user;
    const set = this.socketsByUser.get(user.id) ?? new Set<string>();
    set.add(client.id);
    this.socketsByUser.set(user.id, set);
  }

  handleDisconnect(client: Socket) {
    const user: AuthenticatedUser | undefined = client.data.user;
    if (!user) return;
    this.socketsByUser.get(user.id)?.delete(client.id);
  }

  /**
   * Called by MatchmakingGateway once a Debate row exists in the DB. Pass
   * `aiUserId` (always AI_PRACTICE_USER_ID today) when the opponent is the
   * AI practice partner rather than a second human.
   */
  registerRuntime(debateId: string, topicTitle: string, format: DebateFormat, participants: RuntimeParticipant[], aiUserId?: string) {
    const phases = FORMAT_PHASES[format];
    this.runtimes.set(debateId, {
      topicTitle,
      format,
      phases,
      phaseIndex: 0,
      phaseTimer: null,
      participants,
      transcript: [],
      status: "ACTIVE",
      aiUserId,
      aiRespondedPhaseIndex: -1,
    });
    this.schedulePhaseTimer(debateId);
    this.triggerAiOwnTurnIfDue(debateId);
  }

  @SubscribeMessage("debate:join")
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { debateId: string }) {
    client.join(this.room(body.debateId));
    const state = await this.debatesService.buildStateSnapshot(body.debateId);
    client.emit("debate:state", state);
  }

  @SubscribeMessage("debate:sendMessage")
  async handleMessage(@ConnectedSocket() client: Socket, @MessageBody() body: { debateId: string; body: string }) {
    const user: AuthenticatedUser | undefined = client.data.user;
    if (!user) return;
    const runtime = this.runtimes.get(body.debateId);
    if (!runtime || runtime.status !== "ACTIVE") return;

    const participant = runtime.participants.find((p) => p.userId === user.id);
    if (!participant) return;

    const currentPhase = runtime.phases[runtime.phaseIndex];
    const canSpeak = currentPhase.speakingSide === "BOTH" || currentPhase.speakingSide === participant.side;
    if (!canSpeak) {
      client.emit("error", { message: `It isn't ${participant.side}'s turn to speak right now.` });
      return;
    }

    const text = body.body.trim().slice(0, 4000);
    if (!text) return;

    await this.recordAndBroadcastMessage(body.debateId, runtime, user.id, participant.side, text);

    // If the opponent is the AI and this is a shared-turn phase, have it
    // react to the human rather than wait for its own dedicated turn.
    if (runtime.aiUserId && currentPhase.speakingSide === "BOTH") {
      this.scheduleAiResponse(body.debateId);
    }
  }

  /** Casual Discussion has no timer — either participant can end it manually. */
  @SubscribeMessage("debate:end")
  async handleEnd(@ConnectedSocket() client: Socket, @MessageBody() body: { debateId: string }) {
    const runtime = this.runtimes.get(body.debateId);
    if (!runtime || runtime.status !== "ACTIVE") return;
    if (runtime.format !== "CASUAL") return;
    await this.finalizeDebate(body.debateId);
  }

  @SubscribeMessage("webrtc:signal")
  handleSignal(@ConnectedSocket() client: Socket, @MessageBody() payload: WebRTCSignalPayload) {
    // Peer-to-peer voice/video (v1.1, blueprint §19 ruling): the server only
    // relays the WebRTC offer/answer/ICE-candidate handshake between the two
    // participants' sockets. Media itself never touches the backend — this
    // channel exists purely so the two browsers can find each other.
    const user: AuthenticatedUser | undefined = client.data.user;
    const targetSockets = this.socketsByUser.get(payload.to);
    if (!targetSockets) return;
    for (const socketId of targetSockets) {
      this.server.to(socketId).emit("webrtc:signal", { ...payload, from: user?.id });
    }
  }

  private room(debateId: string) {
    return `debate:${debateId}`;
  }

  /** Shared by real human messages and AI-generated ones so both go through identical persistence/broadcast/moderation. */
  private async recordAndBroadcastMessage(debateId: string, runtime: DebateRuntime, senderId: string, side: DebateSide, body: string) {
    const message = {
      id: randomUUID(),
      debateId,
      senderId,
      side,
      body,
      createdAt: new Date().toISOString(),
    };

    const recentTranscript = runtime.transcript.slice(-6).map((m) => ({ side: m.side, body: m.body }));
    runtime.transcript.push({ senderId, side, body });

    await this.debatesService.appendEvent(debateId, senderId, "MESSAGE", message);
    this.server.to(this.room(debateId)).emit("debate:message", message);

    // Fire-and-forget: the Moderator never blocks the sender's message —
    // it applies equally to the AI opponent's own arguments.
    this.moderator
      .analyzeMessage({ topicTitle: runtime.topicTitle, recentTranscript, newMessage: { side, body } })
      .then((flags) => {
        for (const flag of flags) {
          const payload: ModeratorFlagPayload = {
            id: randomUUID(),
            debateId,
            type: flag.type,
            message: flag.message,
            targetUserId: senderId,
            createdAt: new Date().toISOString(),
          };
          this.debatesService.appendEvent(debateId, null, "MODERATOR_FLAG", payload).catch((err) => this.logger.error(err));
          this.server.to(this.room(debateId)).emit("debate:moderatorFlag", payload);
        }
      })
      .catch((err) => this.logger.error(`Moderator pipeline failed: ${err}`));
  }

  /** Fires once when a phase begins that is the AI's OWN exclusive turn (openings/closings). */
  private triggerAiOwnTurnIfDue(debateId: string) {
    const runtime = this.runtimes.get(debateId);
    if (!runtime?.aiUserId) return;
    const aiParticipant = runtime.participants.find((p) => p.userId === runtime.aiUserId);
    if (!aiParticipant) return;

    const phase = runtime.phases[runtime.phaseIndex];
    if (phase.speakingSide !== aiParticipant.side) return; // only its own dedicated turn, not BOTH
    if (runtime.aiRespondedPhaseIndex === runtime.phaseIndex) return;
    runtime.aiRespondedPhaseIndex = runtime.phaseIndex;
    this.scheduleAiResponse(debateId);
  }

  private scheduleAiResponse(debateId: string) {
    setTimeout(() => this.generateAiTurn(debateId), randomDelayMs(2000, 4500));
  }

  private async generateAiTurn(debateId: string) {
    const runtime = this.runtimes.get(debateId);
    if (!runtime || runtime.status !== "ACTIVE" || !runtime.aiUserId) return;
    const aiParticipant = runtime.participants.find((p) => p.userId === runtime.aiUserId);
    if (!aiParticipant) return;
    const phase = runtime.phases[runtime.phaseIndex];
    if (phase.speakingSide !== "BOTH" && phase.speakingSide !== aiParticipant.side) return;

    const body = await this.debater.generateArgument({
      topicTitle: runtime.topicTitle,
      side: aiParticipant.side,
      phaseLabel: phase.label,
      recentTranscript: runtime.transcript.slice(-6).map((m) => ({ side: m.side, body: m.body })),
    });
    await this.recordAndBroadcastMessage(debateId, runtime, aiParticipant.userId, aiParticipant.side, body);
  }

  private schedulePhaseTimer(debateId: string) {
    const runtime = this.runtimes.get(debateId);
    if (!runtime) return;
    if (runtime.phaseTimer) clearTimeout(runtime.phaseTimer);
    const phase = runtime.phases[runtime.phaseIndex];
    if (phase.durationSec > 0) {
      runtime.phaseTimer = setTimeout(() => this.advancePhase(debateId), phase.durationSec * 1000);
    }
  }

  private async advancePhase(debateId: string) {
    const runtime = this.runtimes.get(debateId);
    if (!runtime || runtime.status !== "ACTIVE") return;

    runtime.phaseIndex += 1;
    const phase = runtime.phases[runtime.phaseIndex];
    if (!phase || phase.key === "JUDGING") {
      this.server.to(this.room(debateId)).emit("debate:phaseChange", { phase: "JUDGING", phaseEndsAt: null });
      await this.finalizeDebate(debateId);
      return;
    }

    const phaseEndsAt = phase.durationSec > 0 ? new Date(Date.now() + phase.durationSec * 1000) : null;
    await this.debatesService.setPhase(debateId, phase.key, phaseEndsAt);
    this.server.to(this.room(debateId)).emit("debate:phaseChange", { phase: phase.key, phaseEndsAt: phaseEndsAt?.toISOString() ?? null });
    this.schedulePhaseTimer(debateId);
    this.triggerAiOwnTurnIfDue(debateId);
  }

  private async finalizeDebate(debateId: string) {
    const runtime = this.runtimes.get(debateId);
    if (!runtime) return;
    runtime.status = "COMPLETED";
    if (runtime.phaseTimer) clearTimeout(runtime.phaseTimer);

    const scorecards = await this.judge.scoreDebate({
      topicTitle: runtime.topicTitle,
      transcript: runtime.transcript.map((m) => ({ side: m.side, body: m.body })),
      participants: runtime.participants.map((p) => ({ userId: p.userId, side: p.side })),
    });

    await this.debatesService.saveScoresAndComplete(debateId, scorecards);
    await this.ratings.applyDebateResult(debateId, scorecards).catch((err) => this.logger.error(`Elo update failed: ${err}`));

    this.server.to(this.room(debateId)).emit("debate:completed", { scores: scorecards });
    this.runtimes.delete(debateId);
  }
}
