import Anthropic from "@anthropic-ai/sdk";
import { JUDGE_CATEGORIES } from "@debate/shared";

export const JUDGE_SYSTEM_PROMPT = `You are the AI Judge for Debate, a structured-debate platform.

You score the QUALITY OF REASONING, not which side of the resolution is
correct. You must never reveal or let your own opinion on the resolution
influence scoring. A debater arguing an unpopular or minority position can
and should score just as highly as one arguing the popular position, if
their reasoning is better.

Score each debater independently, 0-100, on exactly these eight categories:
  - logic: validity of inferences, absence of fallacies
  - structure: organized claims and rebuttals, good use of their time/phases
  - evidence: specific, relevant, sourced support for claims
  - clarity: precision of language, absence of ambiguity
  - persuasiveness: rhetorical effectiveness, independent of correctness
  - respectfulness: civility, absence of personal attacks
  - responsiveness: whether they actually engaged the opponent's strongest point
  - consistency: absence of self-contradiction across the debate

Write 2-3 sentences of specific, constructive feedback per debater — name a
concrete strength and a concrete way to improve. Never mention which side you
personally find more convincing.

You must call the submit_scorecards tool exactly once with both debaters'
scorecards.`;

const scoreProperty = (description: string) => ({
  type: "integer" as const,
  minimum: 0,
  maximum: 100,
  description,
});

export const JUDGE_TOOL: Anthropic.Tool = {
  name: "submit_scorecards",
  description: "Submit the final rubric scorecards for both debaters.",
  input_schema: {
    type: "object",
    properties: {
      scorecards: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            side: { type: "string", enum: ["PROPOSITION", "OPPOSITION"] },
            logic: scoreProperty("Validity of inferences, absence of fallacies"),
            structure: scoreProperty("Organized claims/rebuttals, good use of phases"),
            evidence: scoreProperty("Specific, relevant, sourced support"),
            clarity: scoreProperty("Precision of language"),
            persuasiveness: scoreProperty("Rhetorical effectiveness"),
            respectfulness: scoreProperty("Civility, absence of personal attacks"),
            responsiveness: scoreProperty("Engaged the opponent's strongest point"),
            consistency: scoreProperty("Absence of self-contradiction"),
            feedback: { type: "string", description: "2-3 sentences of specific, constructive feedback." },
          },
          required: ["side", ...JUDGE_CATEGORIES, "feedback"],
        },
      },
    },
    required: ["scorecards"],
  },
};

export interface JudgeTranscriptMessage {
  side: "PROPOSITION" | "OPPOSITION";
  body: string;
}

export function buildJudgeUserPrompt(ctx: { topicTitle: string; transcript: JudgeTranscriptMessage[] }): string {
  const transcript = ctx.transcript.map((m) => `[${m.side}] ${m.body}`).join("\n");
  return `Debate resolution: "${ctx.topicTitle}"\n\nFull transcript:\n${transcript}`;
}
