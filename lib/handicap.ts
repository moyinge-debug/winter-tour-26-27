import { defaultCourses, rounds } from "./data";
import type { CourseSetup, Player, Score, Team, TournamentData, Tee } from "./types";

export function getCourseSetup(courseSetups: CourseSetup[] | undefined, roundId: number): CourseSetup {
  return courseSetups?.find((course) => course.roundId === roundId)
    ?? defaultCourses.find((course) => course.roundId === roundId)
    ?? { roundId, tees: [] };
}

export function getTee(courseSetups: CourseSetup[] | undefined, roundId: number, teeId?: string): Tee | undefined {
  const tees = getCourseSetup(courseSetups, roundId).tees;
  return tees.find((tee) => tee.id === teeId) ?? tees[0];
}

export function getPlayingHandicap(handicap: number, tee: Tee): number {
  return Math.round(handicap * (tee.slopeRating / 113) + (tee.courseRating - tee.par));
}

function getPlayerScore(
  playerId: string,
  roundId: number,
  teams: Team[],
  scores: Score[],
): Score | undefined {
  return scores.find((score) => score.roundId === roundId && score.entryId === playerId)
    ?? scores.find((score) =>
      score.roundId === roundId && teams.some((team) => team.id === score.entryId && team.playerIds.includes(playerId)),
    );
}

function roundToOneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function getTournamentHandicap(
  player: Player,
  roundId: number,
  data: TournamentData,
): number {
  let handicap = roundToOneDecimal(player.handicap);
  const tournamentRounds = data.rounds ?? rounds;
  for (const round of tournamentRounds) {
    if (round.id >= roundId) break;
    handicap = roundToOneDecimal(player.handicapOverrides?.[String(round.id)] ?? handicap);
    const score = getPlayerScore(player.id, round.id, data.teams, data.scores);
    if (!score) continue;
    const tee = getTee(data.courses, round.id, score.teeId);
    if (!tee) continue;
    const playingHandicap = getPlayingHandicap(handicap, tee);
    const adjustment = roundToOneDecimal((score.strokes - playingHandicap - tee.par) / 2);
    handicap = roundToOneDecimal(handicap + adjustment);
  }
  return roundToOneDecimal(player.handicapOverrides?.[String(roundId)] ?? handicap);
}

export function getTournamentHandicapSnapshot(players: Player[], data: TournamentData): Record<string, number> {
  return Object.fromEntries(players.flatMap((player) =>
    (data.rounds ?? rounds).map((round) => [`${player.id}:${round.id}`, getTournamentHandicap(player, round.id, data)]),
  ));
}

export function getHandicapHistory(player: Player, data: TournamentData) {
  let handicap = roundToOneDecimal(player.handicap);
  return (data.rounds ?? rounds).map((round) => {
    handicap = roundToOneDecimal(player.handicapOverrides?.[String(round.id)] ?? handicap);
    const roundHandicap = handicap;
    const score = getPlayerScore(player.id, round.id, data.teams, data.scores);
    const tee = score ? getTee(data.courses, round.id, score.teeId) : undefined;
    const playingHandicap = tee ? getPlayingHandicap(roundHandicap, tee) : undefined;
    const netVsPar = score && playingHandicap !== undefined && tee
      ? score.strokes - playingHandicap - tee.par
      : undefined;
    const adjustment = netVsPar === undefined ? undefined : roundToOneDecimal(netVsPar / 2);
    const nextHandicap = adjustment === undefined ? undefined : roundToOneDecimal(roundHandicap + adjustment);
    if (nextHandicap !== undefined) handicap = nextHandicap;
    return { roundId: round.id, handicap: roundHandicap, playingHandicap, netVsPar, adjustment, nextHandicap };
  });
}
