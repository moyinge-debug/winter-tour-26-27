export type RoundFormat = "Single" | "Greensome" | "Scramble" | "Best ball" | "Foursome";
export type RoundStatus = "upcoming" | "active" | "completed";
export type View = "overview" | "players" | "scorecard" | "leaderboard" | "courses" | "rules";
export type AttendanceStatus = "Ja" | "Nei" | "Kanskje";

export interface Tee {
  id: string;
  name: string;
  par: number;
  courseRating: number;
  slopeRating: number;
}

export interface CourseSetup {
  roundId: number;
  tees: Tee[];
}

export interface Player {
  id: string;
  name: string;
  handicap: number;
  attendance?: AttendanceStatus;
  handicapOverrides?: Record<string, number>;
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
  scorecardImage?: string;
  teeId?: string;
  updatedAt: string;
}

export interface TournamentData {
  players: Player[];
  teams: Team[];
  scores: Score[];
  playerRosterVersion?: number;
  courses?: CourseSetup[];
  rounds?: Round[];
  roundHandicaps?: Record<string, number>;
  houseRules?: string;
}
