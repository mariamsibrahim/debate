import { EloService } from "./elo.service";

describe("EloService", () => {
  const elo = new EloService();

  it("uses a fast K-factor for provisional (<20 game) players", () => {
    expect(elo.kFactor(5, 1000)).toBe(40);
  });

  it("uses a mid K-factor once calibrated but below 1800", () => {
    expect(elo.kFactor(50, 1500)).toBe(20);
  });

  it("uses a slow K-factor for established high-rated players", () => {
    expect(elo.kFactor(50, 1900)).toBe(10);
  });

  it("gives equal-rated players 0.5 expected score against each other", () => {
    expect(elo.expectedScore(1200, 1200)).toBeCloseTo(0.5);
  });

  it("rewards a decisive win between equal-rated players with a positive delta", () => {
    const result = elo.update({
      elo: 1200,
      gamesPlayed: 50,
      opponentElo: 1200,
      outcome: "WIN",
      ownScoreTotal: 700,
      opponentScoreTotal: 300,
    });
    expect(result.delta).toBeGreaterThan(0);
    expect(result.newElo).toBe(1200 + result.delta);
  });

  it("barely moves rating on a draw between equal-rated players with even scorecards", () => {
    const result = elo.update({
      elo: 1200,
      gamesPlayed: 50,
      opponentElo: 1200,
      outcome: "DRAW",
      ownScoreTotal: 500,
      opponentScoreTotal: 500,
    });
    expect(result.delta).toBe(0);
  });

  it("gives an underdog a bigger rating jump for beating a much higher-rated opponent", () => {
    const underdogWin = elo.update({
      elo: 1000,
      gamesPlayed: 50,
      opponentElo: 1600,
      outcome: "WIN",
      ownScoreTotal: 600,
      opponentScoreTotal: 400,
    });
    const favoriteWin = elo.update({
      elo: 1600,
      gamesPlayed: 50,
      opponentElo: 1000,
      outcome: "WIN",
      ownScoreTotal: 600,
      opponentScoreTotal: 400,
    });
    expect(underdogWin.delta).toBeGreaterThan(favoriteWin.delta);
  });

  it("softens a loss when the losing scorecard was still competitive", () => {
    const blowoutLoss = elo.update({
      elo: 1200,
      gamesPlayed: 50,
      opponentElo: 1200,
      outcome: "LOSS",
      ownScoreTotal: 100,
      opponentScoreTotal: 700,
    });
    const closeLoss = elo.update({
      elo: 1200,
      gamesPlayed: 50,
      opponentElo: 1200,
      outcome: "LOSS",
      ownScoreTotal: 450,
      opponentScoreTotal: 550,
    });
    expect(closeLoss.delta).toBeGreaterThan(blowoutLoss.delta);
  });

  it("never drops a rating below the 100 floor", () => {
    const result = elo.update({
      elo: 110,
      gamesPlayed: 50,
      opponentElo: 2000,
      outcome: "LOSS",
      ownScoreTotal: 0,
      opponentScoreTotal: 800,
    });
    expect(result.newElo).toBeGreaterThanOrEqual(100);
  });
});
