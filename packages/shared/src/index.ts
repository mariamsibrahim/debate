// Shared contract between apps/api and apps/web: enums, WebSocket event
// shapes, and debate-format timing tables. Keeping this in one package means
// the backend's authoritative timer and the frontend's countdown can never
// silently drift apart.

export const TOPIC_CATEGORIES = [
  "POLITICS",
  "SCIENCE",
  "HISTORY",
  "TECHNOLOGY",
  "SPORTS",
  "ENTERTAINMENT",
  "PHILOSOPHY",
  "ECONOMICS",
  "GENERAL",
] as const;
export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];

export const DEBATE_FORMATS = ["BLITZ", "STANDARD", "CASUAL"] as const;
export type DebateFormat = (typeof DEBATE_FORMATS)[number];

export type DebateSide = "PROPOSITION" | "OPPOSITION";

// --- Elo tiers (blueprint §10) -------------------------------------------

export interface RankTier {
  name: string;
  min: number;
  max: number;
}

export const RANK_TIERS: RankTier[] = [
  { name: "Bronze", min: 0, max: 999 },
  { name: "Silver", min: 1000, max: 1199 },
  { name: "Gold", min: 1200, max: 1399 },
  { name: "Platinum", min: 1400, max: 1599 },
  { name: "Diamond", min: 1600, max: 1799 },
  { name: "Master", min: 1800, max: 1999 },
  { name: "Grandmaster", min: 2000, max: Infinity },
];

export function tierForElo(elo: number): RankTier {
  return RANK_TIERS.find((t) => elo >= t.min && elo <= t.max) ?? RANK_TIERS[0];
}

// --- Debate phase timing tables (blueprint §7) ----------------------------

export type SpeakingSide = DebateSide | "BOTH" | "NONE";

export interface PhaseDefinition {
  key: string;
  label: string;
  /** 0 means untimed (Casual Discussion). */
  durationSec: number;
  speakingSide: SpeakingSide;
}

export const FORMAT_PHASES: Record<DebateFormat, PhaseDefinition[]> = {
  BLITZ: [
    { key: "OPENING_PROPOSITION", label: "Opening — Proposition", durationSec: 60, speakingSide: "PROPOSITION" },
    { key: "OPENING_OPPOSITION", label: "Opening — Opposition", durationSec: 60, speakingSide: "OPPOSITION" },
    { key: "REBUTTAL", label: "Rebuttal", durationSec: 120, speakingSide: "BOTH" },
    { key: "CLOSING_PROPOSITION", label: "Closing — Proposition", durationSec: 30, speakingSide: "PROPOSITION" },
    { key: "CLOSING_OPPOSITION", label: "Closing — Opposition", durationSec: 30, speakingSide: "OPPOSITION" },
    { key: "JUDGING", label: "AI Judging", durationSec: 0, speakingSide: "NONE" },
  ],
  STANDARD: [
    { key: "OPENING_PROPOSITION", label: "Opening — Proposition", durationSec: 120, speakingSide: "PROPOSITION" },
    { key: "OPENING_OPPOSITION", label: "Opening — Opposition", durationSec: 120, speakingSide: "OPPOSITION" },
    { key: "ROUND_1", label: "Round 1", durationSec: 120, speakingSide: "BOTH" },
    { key: "ROUND_2", label: "Round 2", durationSec: 120, speakingSide: "BOTH" },
    { key: "CROSS_EXAMINATION", label: "Cross-Examination", durationSec: 90, speakingSide: "BOTH" },
    { key: "CLOSING_PROPOSITION", label: "Closing — Proposition", durationSec: 60, speakingSide: "PROPOSITION" },
    { key: "CLOSING_OPPOSITION", label: "Closing — Opposition", durationSec: 60, speakingSide: "OPPOSITION" },
    { key: "JUDGING", label: "AI Judging", durationSec: 0, speakingSide: "NONE" },
  ],
  CASUAL: [{ key: "DISCUSSION", label: "Open Discussion", durationSec: 0, speakingSide: "BOTH" }],
};

export const RANKED_FORMATS: DebateFormat[] = ["BLITZ", "STANDARD"];

// --- AI Moderator ----------------------------------------------------------

export type ModeratorFlagType =
  | "UNSUPPORTED_CLAIM"
  | "LOGICAL_FALLACY"
  | "INCIVILITY"
  | "OFF_TOPIC"
  | "CLARIFICATION_REQUEST";

export interface ModeratorFlagPayload {
  id: string;
  debateId: string;
  type: ModeratorFlagType;
  message: string;
  targetUserId?: string;
  createdAt: string;
}

// --- AI Judge ---------------------------------------------------------------

export const JUDGE_CATEGORIES = [
  "logic",
  "structure",
  "evidence",
  "clarity",
  "persuasiveness",
  "respectfulness",
  "responsiveness",
  "consistency",
] as const;
export type JudgeCategory = (typeof JUDGE_CATEGORIES)[number];

export type JudgeCategoryScores = Record<JudgeCategory, number>;

export interface JudgeScorecard extends JudgeCategoryScores {
  userId: string;
  feedback: string;
  overall: number;
}

// --- Realtime payloads -------------------------------------------------------

export interface DebateMessagePayload {
  id: string;
  debateId: string;
  senderId: string;
  side: DebateSide;
  body: string;
  createdAt: string;
}

export interface DebateParticipantSummary {
  userId: string;
  username: string;
  side: DebateSide;
}

export interface DebateStateSnapshot {
  debateId: string;
  topic: { id: string; title: string; category: TopicCategory };
  format: DebateFormat;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "ABANDONED";
  phase: string;
  phaseEndsAt: string | null;
  participants: DebateParticipantSummary[];
}

export interface WebRTCSignalPayload {
  debateId: string;
  to: string;
  from?: string;
  kind: "offer" | "answer" | "ice-candidate";
  data: unknown;
}

export interface ServerToClientEvents {
  "queue:matched": (payload: { debateId: string }) => void;
  "debate:state": (state: DebateStateSnapshot) => void;
  "debate:message": (msg: DebateMessagePayload) => void;
  "debate:moderatorFlag": (flag: ModeratorFlagPayload) => void;
  "debate:phaseChange": (payload: { phase: string; phaseEndsAt: string | null }) => void;
  "debate:completed": (payload: { scores: JudgeScorecard[] }) => void;
  "webrtc:signal": (payload: WebRTCSignalPayload) => void;
  "error": (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  "debate:join": (payload: { debateId: string }) => void;
  "debate:sendMessage": (payload: { debateId: string; body: string }) => void;
  "debate:end": (payload: { debateId: string }) => void;
  "webrtc:signal": (payload: WebRTCSignalPayload) => void;
  "queue:join": (payload: MatchmakingJoinPayload) => void;
  "queue:leave": () => void;
  "queue:practiceWithAI": (payload: MatchmakingJoinPayload) => void;
}

export interface MatchmakingJoinPayload {
  category: TopicCategory;
  format: DebateFormat;
  language: string;
  mode: "CASUAL" | "RANKED";
  topicId?: string;
}

// A fixed, seeded user that stands in as an opponent when no human is
// available in the queue (blueprint §28's documented cold-start mitigation).
// Practice debates against it are always unranked.
export const AI_PRACTICE_USER_ID = "ai-practice-partner";
export const AI_PRACTICE_USERNAME = "AI Sparring Partner";

// --- Matchmaking --------------------------------------------------------------

export interface MatchmakingRequest {
  userId: string;
  username: string;
  category: TopicCategory;
  topicId?: string;
  format: DebateFormat;
  language: string;
  mode: "CASUAL" | "RANKED";
  elo: number;
  civility: number;
  queuedAt: number;
}
