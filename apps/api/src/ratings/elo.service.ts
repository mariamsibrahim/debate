import { Injectable } from "@nestjs/common";

export type DebateOutcome = "WIN" | "LOSS" | "DRAW";

export interface EloUpdateInput {
  elo: number;
  gamesPlayed: number;
  opponentElo: number;
  outcome: DebateOutcome;
  /** Sum (or average) of this player's 8 AI-Judge category scores. */
  ownScoreTotal: number;
  opponentScoreTotal: number;
}

export interface EloUpdateResult {
  newElo: number;
  delta: number;
  kFactor: number;
}

/**
 * Chess.com-style Elo, blueprint §10:
 *  - K-factor shrinks as a player is calibrated and climbs in rating.
 *  - The "score" fed into the standard Elo formula is 60% match outcome
 *    (win/loss/draw from the AI Judge) and 40% the relative scorecard
 *    totals, so a narrow, well-argued loss costs less than a blowout.
 */
@Injectable()
export class EloService {
  kFactor(gamesPlayed: number, elo: number): number {
    if (gamesPlayed < 20) return 40;
    if (elo < 1800) return 20;
    return 10;
  }

  expectedScore(elo: number, opponentElo: number): number {
    return 1 / (1 + 10 ** ((opponentElo - elo) / 400));
  }

  private outcomeScore(outcome: DebateOutcome): number {
    if (outcome === "WIN") return 1;
    if (outcome === "DRAW") return 0.5;
    return 0;
  }

  private blendedScore(outcome: DebateOutcome, ownTotal: number, opponentTotal: number): number {
    const outcomeComponent = this.outcomeScore(outcome);
    const combined = ownTotal + opponentTotal;
    const scorecardComponent = combined > 0 ? ownTotal / combined : 0.5;
    return 0.6 * outcomeComponent + 0.4 * scorecardComponent;
  }

  update(input: EloUpdateInput): EloUpdateResult {
    const k = this.kFactor(input.gamesPlayed, input.elo);
    const expected = this.expectedScore(input.elo, input.opponentElo);
    const actual = this.blendedScore(input.outcome, input.ownScoreTotal, input.opponentScoreTotal);
    const delta = Math.round(k * (actual - expected));
    const newElo = Math.max(100, input.elo + delta);
    return { newElo, delta, kFactor: k };
  }
}
