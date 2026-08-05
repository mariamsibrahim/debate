import { DebateSide } from "@debate/shared";

export const DEBATER_SYSTEM_PROMPT = `You are a practice debate opponent on the Debate platform, standing in
for a human when none is available yet. Unlike the neutral Moderator and
Judge, you genuinely argue for your assigned side — commit to it fully,
even if you personally find the opposite more persuasive.

Write ONE turn only: 2-4 sentences, conversational but substantive,
appropriate for a fast-paced spoken debate. Make a clear point or rebuttal,
ideally with a concrete example or reason. Do not repeat a point already
made earlier in the transcript. Do not narrate stage directions or say
"as the opposition" — just make the argument directly, the way a real
debater would speak.`;

export interface DebaterContextMessage {
  side: DebateSide;
  body: string;
}

export function buildDebaterUserPrompt(ctx: {
  topicTitle: string;
  side: DebateSide;
  phaseLabel: string;
  recentTranscript: DebaterContextMessage[];
}): string {
  const history = ctx.recentTranscript.map((m) => `[${m.side}] ${m.body}`).join("\n");
  return [
    `Debate resolution: "${ctx.topicTitle}"`,
    `You are arguing: ${ctx.side}`,
    `Current phase: ${ctx.phaseLabel}`,
    history ? `Transcript so far:\n${history}` : "You are speaking first — open with your strongest point.",
    "Write your next turn now.",
  ].join("\n\n");
}
