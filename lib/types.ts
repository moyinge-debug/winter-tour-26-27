export type RoundFormat = "Single" | "Greensome" | "Scramble" | "Best ball" | "Foursome";
export type RoundStatus = "upcoming" | "active" | "completed";
export type View = "overview" | "players" | "scorecard" | "leaderboard";

export interface Player {
  id: string;
  name: string;
  handicap: number;
}

export interface Round {
  id: number;
  course: string;
  format: RoundFormat;
  startDate: string;
  endDate: string;
  location: string;
  par: number;
}

export interface Team {
  id: string;
  roundId: number;
  name: string;
  playerIds: [string, string];
}

export interface Score {
  id: string;
  roundId: number;
  entryId: string;
  strokes: number;
  updatedAt: string;
}

export interface TournamentData {
  players: Player[];
  teams: Team[];
  scores: Score[];
}
