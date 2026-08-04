import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TopicCategory } from "@debate/shared";

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  list(params: { category?: TopicCategory; query?: string; take?: number }) {
    return this.prisma.topic.findMany({
      where: {
        status: "PUBLISHED",
        category: params.category,
        title: params.query ? { contains: params.query, mode: "insensitive" } : undefined,
      },
      orderBy: { popularity: "desc" },
      take: params.take ?? 50,
    });
  }

  trending(take = 10) {
    return this.prisma.topic.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ controversy: "desc" }, { popularity: "desc" }],
      take,
    });
  }

  async getById(id: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id } });
    if (!topic) throw new NotFoundException("Topic not found");
    return topic;
  }

  async getRelated(id: string, take = 5) {
    const relations = await this.prisma.topicRelation.findMany({
      where: { fromTopicId: id },
      orderBy: { weight: "desc" },
      take,
      include: { toTopic: true },
    });
    return relations.map((r) => r.toTopic);
  }

  /**
   * Placeholder for the AI Topic Generator (blueprint §11): given free text,
   * rank existing topics by naive keyword overlap. A real implementation
   * swaps this for an LLM call that proposes new, well-posed resolutions
   * when nothing suitable already exists.
   */
  async suggest(freeText: string, take = 5) {
    const words = freeText
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    if (words.length === 0) return this.trending(take);

    const candidates = await this.prisma.topic.findMany({ where: { status: "PUBLISHED" } });
    return candidates
      .map((topic) => {
        const haystack = `${topic.title} ${topic.subcategory ?? ""}`.toLowerCase();
        const score = words.reduce((acc, w) => acc + (haystack.includes(w) ? 1 : 0), 0);
        return { topic, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score || b.topic.qualityScore - a.topic.qualityScore)
      .slice(0, take)
      .map((c) => c.topic);
  }
}
