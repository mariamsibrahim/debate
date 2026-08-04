import Anthropic from "@anthropic-ai/sdk";

export const MODERATOR_SYSTEM_PROMPT = `You are the neutral AI Moderator for Debate, a structured-debate platform.

Your only job is to keep the debate fair, evidence-based, and on-topic. You are
not a participant and you never argue for or against either side of the
resolution. You do not decide who is right.

Call a tool only when something genuinely warrants a flag. Most messages
deserve no tool call at all — do not flag someone merely for taking a firm
position, being persuasive, or disagreeing. Reserve flags for:
  - a specific factual claim stated with no support or source
  - a real logical fallacy (straw man, ad hominem, false dilemma, slippery
    slope, appeal to emotion, circular reasoning, hasty generalization)
  - a personal attack on the opponent rather than their argument
  - a message that has drifted away from the debate resolution
  - a point that is genuinely unclear and would benefit from clarification

Never call more than one tool per message. If nothing warrants a flag,
respond with plain text saying "no flag" and call no tool.`;

export const MODERATOR_TOOLS: Anthropic.Tool[] = [
  {
    name: "flag_unsupported_claim",
    description: "The speaker asserted a specific factual claim without citing any evidence or source.",
    input_schema: {
      type: "object",
      properties: {
        claim: { type: "string", description: "A short quote or paraphrase of the unsupported claim." },
      },
      required: ["claim"],
    },
  },
  {
    name: "flag_logical_fallacy",
    description: "The speaker's argument contains a named logical fallacy.",
    input_schema: {
      type: "object",
      properties: {
        fallacyName: { type: "string", description: "e.g. straw man, ad hominem, false dilemma, slippery slope" },
        detail: { type: "string", description: "One short clause explaining why this is the fallacy." },
      },
      required: ["fallacyName"],
    },
  },
  {
    name: "flag_incivility",
    description: "The message attacks the opponent personally rather than their argument.",
    input_schema: {
      type: "object",
      properties: { detail: { type: "string", description: "Optional short context." } },
    },
  },
  {
    name: "flag_off_topic",
    description: "The message has drifted away from the debate resolution.",
    input_schema: {
      type: "object",
      properties: { detail: { type: "string", description: "Optional short context." } },
    },
  },
  {
    name: "request_clarification",
    description: "A point was ambiguous enough that a short clarifying question would help both the opponent and the audience.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string", description: "The neutral clarifying question to ask." } },
      required: ["question"],
    },
  },
];

export interface ModeratorContextMessage {
  side: "PROPOSITION" | "OPPOSITION";
  body: string;
}

export function buildModeratorUserPrompt(ctx: {
  topicTitle: string;
  recentTranscript: ModeratorContextMessage[];
  newMessage: ModeratorContextMessage;
}): string {
  const history = ctx.recentTranscript.map((m) => `[${m.side}] ${m.body}`).join("\n");
  return [
    `Debate resolution: "${ctx.topicTitle}"`,
    history ? `Recent transcript:\n${history}` : "This is the first message of the debate.",
    `New message to evaluate:\n[${ctx.newMessage.side}] ${ctx.newMessage.body}`,
  ].join("\n\n");
}
