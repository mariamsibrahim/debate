import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DebateSide, DebateStateSnapshot, FORMAT_PHASES, DebateFormat, JudgeScorecard, TopicCategory } from "@debate/shared";

export interface DebateParticipantInput {
  userId: string;
  username: string;
}

@Injectable()
export class DebatesService {
  constructor(private readonly prisma: PrismaService) {}

  async createDebate(topicId: string, format: DebateFormat, isRanked: boolean, participants: DebateParticipantInput[]) {
    const topic = await this.prisma.topic.findUniqueOrThrow({ where: { id: topicId } });
    const [first, second] = participants;
    const firstSide: DebateSide = Math.random() < 0.5 ? "PROPOSITION" : "OPPOSITION";
    const secondSide: DebateSide = firstSide === "PROPOSITION" ? "OPPOSITION" : "PROPOSITION";

    const firstPhase = FORMAT_PHASES[format][0];
    const now = new Date();
    const phaseEndsAt = firstPhase.durationSec > 0 ? new Date(now.getTime() + firstPhase.durationSec * 1000) : null;

    const debate = await this.prisma.debate.create({
      data: {
        topicId,
        format,
        isRanked,
        status: "ACTIVE",
        currentPhase: firstPhase.key,
        phaseEndsAt,
        startedAt: now,
        participants: {
          create: [
            { userId: first.userId, side: firstSide },
            { userId: second.userId, side: secondSide },
          ],
        },
      },
      include: { participants: true },
    });

    return { debate, topic, sides: new Map([[first.userId, firstSide], [second.userId, secondSide]]) };
  }

  async getDebateWithTopicAndParticipants(debateId: string) {
    const debate = await this.prisma.debate.findUnique({
      where: { id: debateId },
      include: { topic: true, participants: { include: { user: { include: { profile: true } } } } },
    });
    if (!debate) throw new NotFoundException("Debate not found");
    return debate;
  }

  async appendEvent(debateId: string, actorUserId: string | null, type: "MESSAGE" | "PHASE_CHANGE" | "MODERATOR_FLAG" | "SYSTEM", payload: unknown) {
    return this.prisma.debateEvent.create({ data: { debateId, actorUserId: actorUserId ?? undefined, type, payload: payload as any } });
  }

  async getTranscript(debateId: string) {
    const events = await this.prisma.debateEvent.findMany({
      where: { debateId, type: "MESSAGE" },
      orderBy: { createdAt: "asc" },
    });
    return events.map((e) => e.payload as { senderId: string; side: DebateSide; body: string });
  }

  async setPhase(debateId: string, phase: string, phaseEndsAt: Date | null) {
    return this.prisma.debate.update({ where: { id: debateId }, data: { currentPhase: phase, phaseEndsAt } });
  }

  async saveScoresAndComplete(debateId: string, scorecards: JudgeScorecard[]) {
    await this.prisma.$transaction([
      ...scorecards.map((s) =>
        this.prisma.debateScore.create({
          data: {
            debateId,
            userId: s.userId,
            logic: s.logic,
            structure: s.structure,
            evidence: s.evidence,
            clarity: s.clarity,
            persuasiveness: s.persuasiveness,
            respectfulness: s.respectfulness,
            responsiveness: s.responsiveness,
            consistency: s.consistency,
            feedback: s.feedback,
          },
        }),
      ),
      this.prisma.debate.update({ where: { id: debateId }, data: { status: "COMPLETED", endedAt: new Date() } }),
    ]);
  }

  async buildStateSnapshot(debateId: string): Promise<DebateStateSnapshot> {
    const debate = await this.getDebateWithTopicAndParticipants(debateId);
    return {
      debateId: debate.id,
      topic: { id: debate.topic.id, title: debate.topic.title, category: debate.topic.category as TopicCategory },
      format: debate.format as DebateFormat,
      status: debate.status,
      phase: debate.currentPhase,
      phaseEndsAt: debate.phaseEndsAt?.toISOString() ?? null,
      participants: debate.participants.map((p) => ({
        userId: p.userId,
        username: p.user.profile?.username ?? "unknown",
        side: p.side,
      })),
    };
  }
}
