import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { tierForElo } from "@debate/shared";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(username: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { username },
      include: {
        user: {
          include: {
            ratings: true,
            trustScore: true,
            debateParticipants: { select: { result: true } },
            _count: { select: { followers: true, following: true, achievements: true } },
          },
        },
      },
    });
    if (!profile) throw new NotFoundException("User not found");

    const results = profile.user.debateParticipants;
    const record = {
      total: results.length,
      wins: results.filter((r) => r.result === "WIN").length,
      losses: results.filter((r) => r.result === "LOSS").length,
      draws: results.filter((r) => r.result === "DRAW").length,
    };
    const globalElo = profile.user.ratings.length
      ? Math.round(profile.user.ratings.reduce((sum, r) => sum + r.elo, 0) / profile.user.ratings.length)
      : 1000;

    return {
      username: profile.username,
      bio: profile.bio,
      country: profile.country,
      interests: profile.interests,
      favoriteTopics: profile.favoriteTopics,
      avatarUrl: profile.avatarUrl,
      globalElo,
      globalTier: tierForElo(globalElo).name,
      ratings: profile.user.ratings.map((r) => ({
        category: r.category,
        elo: r.elo,
        tier: tierForElo(r.elo).name,
        gamesPlayed: r.gamesPlayed,
      })),
      trustScore: profile.user.trustScore,
      record,
      followerCount: profile.user._count.followers,
      followingCount: profile.user._count.following,
      achievementCount: profile.user._count.achievements,
    };
  }

  async updateMyProfile(userId: string, data: { bio?: string; country?: string; interests?: string[]; favoriteTopics?: string[] }) {
    return this.prisma.profile.update({ where: { userId }, data });
  }
}
