import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { DebateSide, JUDGE_CATEGORIES, JudgeScorecard } from "@debate/shared";
import { JUDGE_SYSTEM_PROMPT, JUDGE_TOOL, JudgeTranscriptMessage, buildJudgeUserPrompt } from "./prompts/judge.prompt";

export interface JudgeParticipant {
  userId: string;
  side: DebateSide;
}

type Provider = "anthropic" | "gemini" | "stub";

const GEMINI_JSON_INSTRUCTIONS = `

Respond with ONLY a single JSON object matching this exact shape, no other
text before or after it:
{
  "scorecards": [
    { "side": "PROPOSITION", "logic": <0-100 integer>, "structure": <0-100 integer>, "evidence": <0-100 integer>, "clarity": <0-100 integer>, "persuasiveness": <0-100 integer>, "respectfulness": <0-100 integer>, "responsiveness": <0-100 integer>, "consistency": <0-100 integer>, "feedback": "<2-3 sentences>" },
    { "side": "OPPOSITION", ... same fields ... }
  ]
}
Exactly two entries, one per side, both required.`;

/**
 * The AI Judge (blueprint §9): runs once, after the debate ends, over the
 * full transcript. It scores reasoning quality across 8 categories and
 * never evaluates which side of the resolution is "correct".
 *
 * Provider order: Anthropic (forced tool-call — the most auditable, used
 * if ANTHROPIC_API_KEY is set) → Gemini (JSON-mode text generation, parsed
 * and validated in code — used if GEMINI_API_KEY is set instead) → stub.
 * Gemini's function-calling schema uses a different type system than
 * Anthropic's tools; JSON mode (a plain, stable feature of both APIs) gets
 * the same structural guarantee without guessing at that schema shape.
 */
@Injectable()
export class JudgeService {
  private readonly logger = new Logger(JudgeService.name);
  private readonly provider: Provider;
  private readonly anthropicClient: Anthropic | null = null;
  private readonly anthropicModel: string;
  private readonly geminiModel: GenerativeModel | null = null;

  constructor(private readonly config: ConfigService) {
    const anthropicKey = this.config.get<string>("ANTHROPIC_API_KEY");
    const geminiKey = this.config.get<string>("GEMINI_API_KEY");
    this.anthropicModel = this.config.get<string>("JUDGE_MODEL", "claude-sonnet-5");

    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
      this.provider = "anthropic";
    } else if (geminiKey) {
      const geminiModelName = this.config.get<string>("GEMINI_MODEL", "gemini-2.0-flash-lite");
      this.geminiModel = new GoogleGenerativeAI(geminiKey).getGenerativeModel({
        model: geminiModelName,
        systemInstruction: JUDGE_SYSTEM_PROMPT + GEMINI_JSON_INSTRUCTIONS,
        generationConfig: { responseMimeType: "application/json" },
      });
      this.provider = "gemini";
    } else {
      this.provider = "stub";
      this.logger.warn("No ANTHROPIC_API_KEY or GEMINI_API_KEY set — AI Judge running in stub mode (neutral flat scorecards).");
    }
  }

  async scoreDebate(ctx: {
    topicTitle: string;
    transcript: JudgeTranscriptMessage[];
    participants: JudgeParticipant[];
  }): Promise<JudgeScorecard[]> {
    if (this.provider === "stub") return ctx.participants.map((p) => this.stubScorecard(p.userId));

    try {
      const cards = this.provider === "anthropic" ? await this.scoreWithAnthropic(ctx) : await this.scoreWithGemini(ctx);
      return this.toScorecards(cards, ctx.participants);
    } catch (err) {
      this.logger.error(`AI Judge scoring failed (${this.provider}), falling back to neutral scorecards: ${(err as Error).message}`);
      return ctx.participants.map((p) => this.stubScorecard(p.userId));
    }
  }

  private async scoreWithAnthropic(ctx: { topicTitle: string; transcript: JudgeTranscriptMessage[] }): Promise<Array<Record<string, unknown>>> {
    const response = await this.anthropicClient!.messages.create({
      model: this.anthropicModel,
      max_tokens: 1200,
      system: JUDGE_SYSTEM_PROMPT,
      tools: [JUDGE_TOOL],
      tool_choice: { type: "tool", name: "submit_scorecards" },
      messages: [{ role: "user", content: buildJudgeUserPrompt(ctx) }],
    });

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) throw new Error("Judge did not return a tool call");
    const input = toolUse.input as { scorecards: Array<Record<string, unknown>> };
    return input.scorecards;
  }

  private async scoreWithGemini(ctx: { topicTitle: string; transcript: JudgeTranscriptMessage[] }): Promise<Array<Record<string, unknown>>> {
    const result = await this.geminiModel!.generateContent(buildJudgeUserPrompt(ctx));
    const parsed = JSON.parse(result.response.text()) as { scorecards: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.scorecards) || parsed.scorecards.length !== 2) {
      throw new Error("Gemini did not return exactly two scorecards");
    }
    return parsed.scorecards;
  }

  private toScorecards(cards: Array<Record<string, unknown>>, participants: JudgeParticipant[]): JudgeScorecard[] {
    return cards.map((card) => {
      const participant = participants.find((p) => p.side === card.side);
      if (!participant) throw new Error(`Judge scorecard referenced unknown side ${card.side}`);
      const categories = Object.fromEntries(JUDGE_CATEGORIES.map((key) => [key, Number(card[key])])) as Record<
        (typeof JUDGE_CATEGORIES)[number],
        number
      >;
      const overall = Math.round(JUDGE_CATEGORIES.reduce((sum, key) => sum + categories[key], 0) / JUDGE_CATEGORIES.length);
      return { userId: participant.userId, feedback: String(card.feedback), overall, ...categories };
    });
  }

  private stubScorecard(userId: string): JudgeScorecard {
    const flat = Object.fromEntries(JUDGE_CATEGORIES.map((key) => [key, 70])) as Record<(typeof JUDGE_CATEGORIES)[number], number>;
    return { userId, feedback: "AI Judge unavailable — this is a placeholder neutral scorecard.", overall: 70, ...flat };
  }
}
