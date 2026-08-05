import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { DebateSide } from "@debate/shared";
import { DEBATER_SYSTEM_PROMPT, DebaterContextMessage, buildDebaterUserPrompt } from "./prompts/debater.prompt";

type Provider = "anthropic" | "gemini" | "stub";

/**
 * The AI practice opponent (blueprint §28's cold-start mitigation): stands
 * in for a human when the matchmaking queue is empty. It genuinely argues a
 * side — a completely different job from the neutral Moderator/Judge, so it
 * gets its own prompt and its own service rather than reusing theirs.
 *
 * Provider choice, in order: Anthropic (if ANTHROPIC_API_KEY set) → Gemini
 * (if GEMINI_API_KEY set — Google's free tier needs no billing) → stub.
 * Only this service supports the Gemini fallback: it's plain text
 * generation, unlike the Moderator/Judge's tool-calling flows, which Gemini
 * models via a different API shape not worth replicating for this MVP.
 */
@Injectable()
export class DebaterService {
  private readonly logger = new Logger(DebaterService.name);
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
        systemInstruction: DEBATER_SYSTEM_PROMPT,
      });
      this.provider = "gemini";
    } else {
      this.provider = "stub";
      this.logger.warn("No ANTHROPIC_API_KEY or GEMINI_API_KEY set — AI practice opponent running in stub mode.");
    }
  }

  async generateArgument(ctx: {
    topicTitle: string;
    side: DebateSide;
    phaseLabel: string;
    recentTranscript: DebaterContextMessage[];
  }): Promise<string> {
    if (this.provider === "stub") {
      return `(Stub AI opponent — set ANTHROPIC_API_KEY or GEMINI_API_KEY for real arguments.) As the ${ctx.side.toLowerCase()}, I'd push back on that: "${ctx.topicTitle}" deserves a harder look at the tradeoffs here.`;
    }

    try {
      if (this.provider === "anthropic") {
        const response = await this.anthropicClient!.messages.create({
          model: this.anthropicModel,
          max_tokens: 300,
          system: DEBATER_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildDebaterUserPrompt(ctx) }],
        });
        const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
        return textBlock?.text.trim() ?? "(The AI opponent had nothing to add this turn.)";
      }

      // Gemini
      const result = await this.geminiModel!.generateContent(buildDebaterUserPrompt(ctx));
      const text = result.response.text().trim();
      return text || "(The AI opponent had nothing to add this turn.)";
    } catch (err) {
      this.logger.error(`AI opponent generation failed (${this.provider}): ${(err as Error).message}`);
      return "(The AI opponent hit an error generating a response this turn.)";
    }
  }
}
