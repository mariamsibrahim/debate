import { ModeratorFlagPayload } from "@debate/shared";

const LABELS: Record<ModeratorFlagPayload["type"], string> = {
  UNSUPPORTED_CLAIM: "Evidence requested",
  LOGICAL_FALLACY: "Fallacy flagged",
  INCIVILITY: "Civility notice",
  OFF_TOPIC: "Off-topic",
  CLARIFICATION_REQUEST: "Clarification requested",
};

/**
 * The Moderator's interjections render in their own lane, visually distinct
 * from either debater's messages — neutrality has to be legible in the UI,
 * not just true in the prompt (blueprint §16).
 */
export function ModeratorLane({ flags }: { flags: ModeratorFlagPayload[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="space-y-2 border-l-2 border-ink-muted/40 pl-3">
      {flags.map((flag) => (
        <div key={flag.id} className="font-mono text-[13px] text-ink-muted">
          <span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{LABELS[flag.type]}</span>
          {flag.message}
        </div>
      ))}
    </div>
  );
}
