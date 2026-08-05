import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import Groq from "groq-sdk";
import { DebateSide, JUDGE_CATEGORIES, JudgeScorecard } from "@debate/shared";
import { JUDGE_SYSTEM_PROMPT, JUDGE_TOOL, JudgeTranscriptMessage, buildJudgeUserPrompt } from "./prompts/judge.prompt";

export interface JudgeParticipant {
  userId: string;
  side: DebateSide;
}

type Provider = "anthropic" | "gemini" | "groq" | "stub";

const JSON_MODE_INSTRUCTIONS = `

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
 * Provider order: Anthropic (forced tool-call, most auditable) → Gemini
 * (JSON mode) → Groq (JSON mode) → stub. Gemini and Groq both use plain
 * JSON-mode text generation rather than replicating Anthropic's tool
 * schema in each provider's own function-calling shape — simpler and
 * lower-risk than guessing at those schemas' exact types.
 */
@Injectable()
export class JudgeService {
  private readonly logger = new Logger(JudgeService.name);
  private readonly provider: Provider;
  private readonly anthropicClient: Anthropic | null = null;
  private readonly anthropicModel: string;
  private readonly geminiModel: GenerativeModel | null = null;
  private readonly groqClient: Groq | null = null;
  private readonly groqModel: string;

  constructor(private readonly config: ConfigService) {
    const anthropicKey = this.config.get<string>("ANTHROPIC_API_KEY");
    const geminiKey = this.config.get<string>("GEMINI_API_KEY");
    const groqKey = this.config.get<string>("GROQ_API_KEY");
    this.anthropicModel = this.config.get<string>("JUDGE_MODEL", "claude-sonnet-5");
    this.groqModel = this.config.get<string>("GROQ_MODEL", "llama-3.3-70b-versatile");

    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
      this.provider = "anthropic";
    } else if (geminiKey) {
      const geminiModelName = this.config.get<string>("GEMINI_MODEL", "gemini-2.0-flash-lite");
      this.geminiModel = new GoogleGenerativeAI(geminiKey).getGenerativeModel({
        model: geminiModelName,
        systemInstruction: JUDGE_SYSTEM_PROMPT + JSON_MODE_INSTRUCTIONS,
        generationConfig: { responseMimeType: "application/json" },
      });
      this.provider = "gemini";
    } else if (groqKey) {
      this.groqClient = new Groq({ apiKey: groqKey });
      this.provider = "groq";
    } else {
      this.provider = "stub";
      this.logger.warn("No ANTHROPIC_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY set — AI Judge running in stub mode (neutral flat scorecards).");
    }
  }

  async scoreDebate(ctx: {
    topicTitle: string;
    transcript: JudgeTranscriptMessage[];
    participants: JudgeParticipant[];
  }): Promise<JudgeScorecard[]> {
    if (this.provider === "stub") return ctx.participants.map((p) => this.stubScorecard(p.userId));

    try {
      const cards = await this.scoreWithProvider(ctx);
      return this.toScorecards(cards, ctx.participants);
    } catch (err) {
      this.logger.error(`AI Judge scoring failed (${this.provider}), falling back to neutral scorecards: ${(err as Error).message}`);
      return ctx.participants.map((p) => this.stubScorecard(p.userId));
    }
  }

  private async scoreWithProvider(ctx: { topicTitle: string; transcript: JudgeTranscriptMessage[] }): Promise<Array<Record<string, unknown>>> {
    if (this.provider === "anthropic") {
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

    if (this.provider === "gemini") {
      const result = await this.geminiModel!.generateContent(buildJudgeUserPrompt(ctx));
      const parsed = JSON.parse(result.response.text()) as { scorecards: Array<Record<string, unknown>> };
      if (!Array.isArray(parsed.scorecards) || parsed.scorecards.length !== 2) throw new Error("Gemini did not return exactly two scorecards");
      return parsed.scorecards;
    }

    // Groq (OpenAI-compatible chat completions, JSON mode)
    const completion = await this.groqClient!.chat.completions.create({
      model: this.groqModel,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: JUDGE_SYSTEM_PROMPT + JSON_MODE_INSTRUCTIONS },
        { role: "user", content: buildJudgeUserPrompt(ctx) },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Groq returned no content");
    const parsed = JSON.parse(raw) as { scorecards: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.scorecards) || parsed.scorecards.length !== 2) throw new Error("Groq did not return exactly two scorecards");
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
