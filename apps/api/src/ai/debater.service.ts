import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { DebateSide } from "@debate/shared";
import { DEBATER_SYSTEM_PROMPT, DebaterContextMessage, buildDebaterUserPrompt } from "./prompts/debater.prompt";

/**
 * The AI practice opponent (blueprint §28's cold-start mitigation): stands
 * in for a human when the matchmaking queue is empty. It genuinely argues a
 * side — a completely different job from the neutral Moderator/Judge, so it
 * gets its own prompt and its own service rather than reusing theirs.
 */
@Injectable()
export class DebaterService {
  private readonly logger = new Logger(DebaterService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = this.config.get<string>("JUDGE_MODEL", "claude-sonnet-5");
    if (!this.client) {
      this.logger.warn("ANTHROPIC_API_KEY not set — AI practice opponent running in stub mode.");
    }
  }

  async generateArgument(ctx: {
    topicTitle: string;
    side: DebateSide;
    phaseLabel: string;
    recentTranscript: DebaterContextMessage[];
  }): Promise<string> {
    if (!this.client) {
      return `(Stub AI opponent — set ANTHROPIC_API_KEY for real arguments.) As the ${ctx.side.toLowerCase()}, I'd push back on that: "${ctx.topicTitle}" deserves a harder look at the tradeoffs here.`;
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 300,
        system: DEBATER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildDebaterUserPrompt(ctx) }],
      });
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      return textBlock?.text.trim() ?? "(The AI opponent had nothing to add this turn.)";
    } catch (err) {
      this.logger.error(`AI opponent generation failed: ${(err as Error).message}`);
      return "(The AI opponent hit an error generating a response this turn.)";
    }
  }
}
