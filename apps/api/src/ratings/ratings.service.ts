import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EloService } from "./elo.service";
import { JUDGE_CATEGORIES, JudgeScorecard, TopicCategory, tierForElo } from "@debate/shared";

const UNRATED_CATEGORIES: TopicCategory[] = ["GENERAL"];

function scorecardTotal(scorecard: Pick<JudgeScorecard, (typeof JUDGE_CATEGORIES)[number]>): number {
  return JUDGE_CATEGORIES.reduce((sum, key) => sum + scorecard[key], 0);
}

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly elo: EloService,
  ) {}

  /**
   * Called once a debate's two AI-Judge scorecards are in. Decides
   * win/loss/draw from the scorecards, and — only for ranked debates on a
   * rated category — updates both players' category Elo (blueprint §10).
   * Casual debates and GENERAL-category topics never touch Elo, by design.
   */
  async applyDebateResult(debateId: string, scorecards: JudgeScorecard[]) {
    const debate = await this.prisma.debate.findUniqueOrThrow({
      where: { id: debateId },
      include: { participants: true, topic: true },
    });

    const [a, b] = debate.participants;
    const scoreA = scorecards.find((s) => s.userId === a.userId)!;
    const scoreB = scorecards.find((s) => s.userId === b.userId)!;
    const totalA = scorecardTotal(scoreA);
    const totalB = scorecardTotal(scoreB);

    const DRAW_MARGIN = 20; // out of a max 800 (8 categories x 100)
    let resultA: "WIN" | "LOSS" | "DRAW";
    let resultB: "WIN" | "LOSS" | "DRAW";
    if (Math.abs(totalA - totalB) <= DRAW_MARGIN) {
      resultA = resultB = "DRAW";
    } else if (totalA > totalB) {
      resultA = "WIN";
      resultB = "LOSS";
    } else {
      resultA = "LOSS";
      resultB = "WIN";
    }

    const isRated = debate.isRanked && !UNRATED_CATEGORIES.includes(debate.topic.category as TopicCategory);

    if (!isRated) {
      await this.prisma.$transaction([
        this.prisma.debateParticipant.update({ where: { id: a.id }, data: { result: resultA } }),
        this.prisma.debateParticipant.update({ where: { id: b.id }, data: { result: resultB } }),
      ]);
      return { resultA, resultB, ratingChanged: false };
    }

    const category = debate.topic.category;
    const [ratingA, ratingB] = await Promise.all([
      this.getOrCreateRating(a.userId, category),
      this.getOrCreateRating(b.userId, category),
    ]);

    const updateA = this.elo.update({
      elo: ratingA.elo,
      gamesPlayed: ratingA.gamesPlayed,
      opponentElo: ratingB.elo,
      outcome: resultA,
      ownScoreTotal: totalA,
      opponentScoreTotal: totalB,
    });
    const updateB = this.elo.update({
      elo: ratingB.elo,
      gamesPlayed: ratingB.gamesPlayed,
      opponentElo: ratingA.elo,
      outcome: resultB,
      ownScoreTotal: totalB,
      opponentScoreTotal: totalA,
    });

    await this.prisma.$transaction([
      this.prisma.rating.update({
        where: { id: ratingA.id },
        data: { elo: updateA.newElo, gamesPlayed: { increment: 1 } },
      }),
      this.prisma.rating.update({
        where: { id: ratingB.id },
        data: { elo: updateB.newElo, gamesPlayed: { increment: 1 } },
      }),
      this.prisma.debateParticipant.update({
        where: { id: a.id },
        data: { result: resultA, eloBefore: ratingA.elo, eloAfter: updateA.newElo },
      }),
      this.prisma.debateParticipant.update({
        where: { id: b.id },
        data: { result: resultB, eloBefore: ratingB.elo, eloAfter: updateB.newElo },
      }),
    ]);

    this.logger.log(
      `Debate ${debateId} [${category}]: ${a.userId} ${ratingA.elo}->${updateA.newElo}, ${b.userId} ${ratingB.elo}->${updateB.newElo}`,
    );

    return { resultA, resultB, ratingChanged: true, updateA, updateB };
  }

  private async getOrCreateRating(userId: string, category: TopicCategory) {
    const existing = await this.prisma.rating.findUnique({ where: { userId_category: { userId, category } } });
    if (existing) return existing;
    return this.prisma.rating.create({ data: { userId, category, elo: 1000 } });
  }

  async leaderboard(category?: TopicCategory, take = 20) {
    if (category) {
      const rows = await this.prisma.rating.findMany({
        where: { category },
        orderBy: { elo: "desc" },
        take,
        include: { user: { include: { profile: true } } },
      });
      return rows.map((r) => ({
        username: r.user.profile?.username,
        category: r.category,
        elo: r.elo,
        tier: tierForElo(r.elo).name,
        gamesPlayed: r.gamesPlayed,
      }));
    }

    // Global leaderboard: participation-weighted average across a user's
    // category ratings, computed in-app rather than as a stored column so
    // it can never drift out of sync with the per-category source of truth.
    const users = await this.prisma.user.findMany({
      include: { ratings: true, profile: true },
      where: { ratings: { some: {} } },
    });
    return users
      .map((u) => {
        const totalGames = u.ratings.reduce((s, r) => s + r.gamesPlayed, 0);
        const globalElo = totalGames
          ? Math.round(u.ratings.reduce((s, r) => s + r.elo * r.gamesPlayed, 0) / totalGames)
          : Math.round(u.ratings.reduce((s, r) => s + r.elo, 0) / (u.ratings.length || 1));
        return { username: u.profile?.username, elo: globalElo, tier: tierForElo(globalElo).name, gamesPlayed: totalGames };
      })
      .sort((a, b) => b.elo - a.elo)
      .slice(0, take);
  }
}
