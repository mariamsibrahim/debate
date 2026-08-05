import { Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { AI_PRACTICE_USER_ID, AI_PRACTICE_USERNAME, DebateSide, MatchmakingJoinPayload, TopicCategory } from "@debate/shared";
import { authenticateSocket } from "../common/socket-auth.util";
import { AuthenticatedUser } from "../common/guards/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { MatchmakingService, QueueEntry } from "./matchmaking.service";
import { DebatesService } from "../debates/debates.service";
import { DebatesGateway } from "../debates/debates.gateway";

const TICK_MS = 1000;

@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" } })
export class MatchmakingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(MatchmakingGateway.name);
  private tickHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly matchmaking: MatchmakingService,
    private readonly prisma: PrismaService,
    private readonly debatesService: DebatesService,
    private readonly debatesGateway: DebatesGateway,
  ) {}

  onModuleInit() {
    this.tickHandle = setInterval(() => this.tick().catch((err) => this.logger.error(err)), TICK_MS);
  }

  onModuleDestroy() {
    if (this.tickHandle) clearInterval(this.tickHandle);
  }

  handleConnection(client: Socket) {
    const user = authenticateSocket(client, this.jwt);
    if (user) client.data.user = user;
  }

  handleDisconnect(client: Socket) {
    const user: AuthenticatedUser | undefined = client.data.user;
    if (user) this.matchmaking.leave(user.id);
  }

  @SubscribeMessage("queue:join")
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: MatchmakingJoinPayload) {
    const user: AuthenticatedUser | undefined = client.data.user;
    if (!user) return;

    const [rating, trustScore] = await Promise.all([
      payload.category === "GENERAL"
        ? null
        : this.prisma.rating.findUnique({ where: { userId_category: { userId: user.id, category: payload.category } } }),
      this.prisma.trustScore.findUnique({ where: { userId: user.id } }),
    ]);

    const entry: QueueEntry = {
      userId: user.id,
      username: user.username,
      category: payload.category,
      topicId: payload.topicId,
      format: payload.format,
      language: payload.language || "en",
      mode: payload.mode,
      elo: rating?.elo ?? 1000,
      civility: trustScore?.civility ?? 75,
      queuedAt: Date.now(),
      socketId: client.id,
    };
    this.matchmaking.join(entry);
  }

  @SubscribeMessage("queue:leave")
  handleLeave(@ConnectedSocket() client: Socket) {
    const user: AuthenticatedUser | undefined = client.data.user;
    if (user) this.matchmaking.leave(user.id);
  }

  /**
   * Cold-start mitigation (blueprint §28): when no human opponent shows up,
   * the client can request a practice debate against the seeded AI
   * partner instead of waiting on an empty queue forever. Always unranked.
   */
  @SubscribeMessage("queue:practiceWithAI")
  async handlePracticeWithAI(@ConnectedSocket() client: Socket, @MessageBody() payload: MatchmakingJoinPayload) {
    const user: AuthenticatedUser | undefined = client.data.user;
    if (!user) return;
    this.matchmaking.leave(user.id);

    try {
      const topicId = await this.pickTopicIdForCategory(payload.category, payload.topicId);
      const { debate, topic, sides } = await this.debatesService.createDebate(topicId, payload.format, false, [
        { userId: user.id, username: user.username },
        { userId: AI_PRACTICE_USER_ID, username: AI_PRACTICE_USERNAME },
      ]);

      this.debatesGateway.registerRuntime(
        debate.id,
        topic.title,
        payload.format,
        [
          { userId: user.id, username: user.username, side: sides.get(user.id) as DebateSide },
          { userId: AI_PRACTICE_USER_ID, username: AI_PRACTICE_USERNAME, side: sides.get(AI_PRACTICE_USER_ID) as DebateSide },
        ],
        AI_PRACTICE_USER_ID,
      );

      client.emit("queue:matched", { debateId: debate.id });
    } catch (err) {
      this.logger.error(`Failed to create AI practice debate for ${user.id}: ${err}`);
      client.emit("error", { message: "Couldn't start a practice debate — please try again." });
    }
  }

  private async tick() {
    const matches = this.matchmaking.tick();
    for (const { a, b } of matches) {
      try {
        await this.createMatchedDebate(a, b);
      } catch (err) {
        this.logger.error(`Failed to create debate for matched pair ${a.userId}/${b.userId}: ${err}`);
      }
    }
  }

  private async createMatchedDebate(a: QueueEntry, b: QueueEntry) {
    const topicId = await this.pickTopicId(a, b);
    const isRanked = a.mode === "RANKED";

    const { debate, topic, sides } = await this.debatesService.createDebate(topicId, a.format, isRanked, [
      { userId: a.userId, username: a.username },
      { userId: b.userId, username: b.username },
    ]);

    this.debatesGateway.registerRuntime(
      debate.id,
      topic.title,
      a.format,
      [a, b].map((entry) => ({
        userId: entry.userId,
        username: entry.username,
        side: sides.get(entry.userId) as DebateSide,
      })),
    );

    this.matchmaking.recordMatch(a.userId, b.userId);
    this.server.to(a.socketId).emit("queue:matched", { debateId: debate.id });
    this.server.to(b.socketId).emit("queue:matched", { debateId: debate.id });
  }

  private async pickTopicId(a: QueueEntry, b: QueueEntry): Promise<string> {
    if (a.topicId && a.topicId === b.topicId) return a.topicId;
    if (a.topicId) return a.topicId;
    if (b.topicId) return b.topicId;

    const candidates = await this.prisma.topic.findMany({
      where: { status: "PUBLISHED", category: a.category === "GENERAL" ? undefined : a.category },
      select: { id: true },
    });
    if (candidates.length === 0) throw new Error(`No published topics available for category ${a.category}`);
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  }

  private async pickTopicIdForCategory(category: TopicCategory, topicId?: string): Promise<string> {
    if (topicId) return topicId;
    const candidates = await this.prisma.topic.findMany({
      where: { status: "PUBLISHED", category: category === "GENERAL" ? undefined : category },
      select: { id: true },
    });
    if (candidates.length === 0) throw new Error(`No published topics available for category ${category}`);
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  }
}
