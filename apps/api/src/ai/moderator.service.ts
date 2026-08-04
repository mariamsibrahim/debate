import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { ModeratorFlagType } from "@debate/shared";
import { MODERATOR_SYSTEM_PROMPT, MODERATOR_TOOLS, ModeratorContextMessage, buildModeratorUserPrompt } from "./prompts/moderator.prompt";

export interface ModeratorFlagDraft {
  type: ModeratorFlagType;
  message: string;
}

const TOOL_TO_FLAG_TYPE: Record<string, ModeratorFlagType> = {
  flag_unsupported_claim: "UNSUPPORTED_CLAIM",
  flag_logical_fallacy: "LOGICAL_FALLACY",
  flag_incivility: "INCIVILITY",
  flag_off_topic: "OFF_TOPIC",
  request_clarification: "CLARIFICATION_REQUEST",
};

/**
 * The AI Moderator (blueprint §8): a non-participant overlay that watches
 * the transcript stream and flags evidence gaps, fallacies, incivility, and
 * off-topic drift. It never argues a position, and it is a *separate*
 * pipeline from the AI Judge (see judge.service.ts) — the Moderator must be
 * fast/cheap/tolerant of noise, the Judge must be slow/thorough/auditable.
 * Deterministic timing and turn-taking live in DebatesService, not here.
 */
@Injectable()
export class ModeratorService {
  private readonly logger = new Logger(ModeratorService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = this.config.get<string>("MODERATOR_MODEL", "claude-haiku-4-5-20251001");
    if (!this.client) {
      this.logger.warn("ANTHROPIC_API_KEY not set — AI Moderator running in stub mode (no flags will be produced).");
    }
  }

  async analyzeMessage(ctx: {
    topicTitle: string;
    recentTranscript: ModeratorContextMessage[];
    newMessage: ModeratorContextMessage;
  }): Promise<ModeratorFlagDraft[]> {
    if (!this.client) return [];

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 400,
        system: MODERATOR_SYSTEM_PROMPT,
        tools: MODERATOR_TOOLS,
        messages: [{ role: "user", content: buildModeratorUserPrompt(ctx) }],
      });
      return response.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
        .map((block) => this.toFlag(block))
        .filter((f): f is ModeratorFlagDraft => f !== null);
    } catch (err) {
      this.logger.error(`Moderator analysis failed: ${(err as Error).message}`);
      return [];
    }
  }

  private toFlag(block: Anthropic.ToolUseBlock): ModeratorFlagDraft | null {
    const type = TOOL_TO_FLAG_TYPE[block.name];
    if (!type) return null;
    const input = block.input as Record<string, string>;

    switch (block.name) {
      case "flag_unsupported_claim":
        return { type, message: `You made a factual claim ("${input.claim}") without supporting evidence — would you like to cite a source?` };
      case "flag_logical_fallacy":
        return { type, message: `That reads as ${input.fallacyName}${input.detail ? ` — ${input.detail}` : ""}.` };
      case "flag_incivility":
        return { type, message: `Let's keep this focused on the argument, not the person.${input.detail ? ` (${input.detail})` : ""}` };
      case "flag_off_topic":
        return { type, message: `This argument appears unrelated to the resolution. Consider returning to the core question.${input.detail ? ` (${input.detail})` : ""}` };
      case "request_clarification":
        return { type, message: input.question };
      default:
        return null;
    }
  }
}
