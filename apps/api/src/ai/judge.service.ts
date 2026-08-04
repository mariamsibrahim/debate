import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { DebateSide, JUDGE_CATEGORIES, JudgeScorecard } from "@debate/shared";
import { JUDGE_SYSTEM_PROMPT, JUDGE_TOOL, JudgeTranscriptMessage, buildJudgeUserPrompt } from "./prompts/judge.prompt";

export interface JudgeParticipant {
  userId: string;
  side: DebateSide;
}

/**
 * The AI Judge (blueprint §9): runs once, after the debate ends, over the
 * full transcript. It scores reasoning quality across 8 categories and
 * never evaluates which side of the resolution is "correct". Structured
 * (forced tool-call) output only — no free-text parsing — so scores are
 * auditable and reproducible.
 */
@Injectable()
export class JudgeService {
  private readonly logger = new Logger(JudgeService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = this.config.get<string>("JUDGE_MODEL", "claude-sonnet-5");
    if (!this.client) {
      this.logger.warn("ANTHROPIC_API_KEY not set — AI Judge running in stub mode (neutral flat scorecards).");
    }
  }

  async scoreDebate(ctx: {
    topicTitle: string;
    transcript: JudgeTranscriptMessage[];
    participants: JudgeParticipant[];
  }): Promise<JudgeScorecard[]> {
    if (!this.client) return ctx.participants.map((p) => this.stubScorecard(p.userId));

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1200,
        system: JUDGE_SYSTEM_PROMPT,
        tools: [JUDGE_TOOL],
        tool_choice: { type: "tool", name: "submit_scorecards" },
        messages: [{ role: "user", content: buildJudgeUserPrompt(ctx) }],
      });

      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!toolUse) throw new Error("Judge did not return a tool call");

      const input = toolUse.input as { scorecards: Array<Record<string, unknown>> };
      return input.scorecards.map((card) => {
        const participant = ctx.participants.find((p) => p.side === card.side);
        if (!participant) throw new Error(`Judge scorecard referenced unknown side ${card.side}`);
        const categories = Object.fromEntries(JUDGE_CATEGORIES.map((key) => [key, Number(card[key])])) as Record<
          (typeof JUDGE_CATEGORIES)[number],
          number
        >;
        const overall = Math.round(JUDGE_CATEGORIES.reduce((sum, key) => sum + categories[key], 0) / JUDGE_CATEGORIES.length);
        return { userId: participant.userId, feedback: String(card.feedback), overall, ...categories };
      });
    } catch (err) {
      this.logger.error(`AI Judge scoring failed, falling back to neutral scorecards: ${(err as Error).message}`);
      return ctx.participants.map((p) => this.stubScorecard(p.userId));
    }
  }

  private stubScorecard(userId: string): JudgeScorecard {
    const flat = Object.fromEntries(JUDGE_CATEGORIES.map((key) => [key, 70])) as Record<(typeof JUDGE_CATEGORIES)[number], number>;
    return { userId, feedback: "AI Judge unavailable — this is a placeholder neutral scorecard.", overall: 70, ...flat };
  }
}
