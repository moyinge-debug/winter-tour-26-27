"use client";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  ClipboardList,
  CircleHelp,
  Download,
  Flag,
  LoaderCircle,
  Lock,
  Medal,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ScanLine,
  Trash2,
  Trophy,
  Unlock,
  Upload,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultCourses, formatPeriod, getRoundStatus, initialPlayers, isTeamFormat, rounds } from "@/lib/data";
import { getCourseSetup, getHandicapHistory, getPlayingHandicap, getTournamentHandicap, getTournamentHandicapSnapshot, getTee } from "@/lib/handicap";
import type { AttendanceStatus, CourseSetup, Player, Round, RoundFormat, Score, Team, Tee, TournamentData, View } from "@/lib/types";

const STORAGE_KEY = "winter-tour-26-27";
const ADMIN_SESSION_KEY = "winter-tour-26-27-admin";
const ADMIN_PIN = "2026";
const DEMO_PLAYER_IDS = new Set(["p1", "p2", "p3", "p4", "p5", "p6"]);
const DEMO_TEAM_IDS = new Set(["t2a", "t2b", "t2c", "t4a", "t4b", "t4c", "t6a", "t6b", "t6c", "t8a", "t8b", "t8c"]);
const DEMO_SCORE_IDS = new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"]);
const PLAYER_ROSTER_VERSION = 1;
const DEFAULT_HOUSE_RULES = "Avklar eventuelle gimme-avstander, mulligans og TrackMan-innstillinger med gruppen før runden. Bruk bare regler som turneringsgruppen har vedtatt.";
const ATTENDANCE_STATUSES: AttendanceStatus[] = ["Ja", "Nei", "Kanskje"];
const ROUND_FORMATS: RoundFormat[] = ["Single", "Greensome", "Scramble", "Best ball", "Foursome"];
const NAV_ITEMS: { id: View; label: string; icon: typeof Flag }[] = [
  { id: "overview", label: "Oversikt", icon: Flag },
  { id: "players", label: "Spillere & lag", icon: Users },
  { id: "scorecard", label: "Scorekort", icon: ClipboardList },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "courses", label: "Baner & Tee-oppsett", icon: Flag },
  { id: "rules", label: "Regler", icon: BookOpen },
];

type ResultRow = {
  entryId: string;
  label: string;
  playerIds: string[];
  strokes: number;
  playingHandicap: number;
  netStrokes: number;
  teeName: string;
  teePar: number;
  score: Score;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatScore(score: number) {
  return score.toFixed(2).replace(/\.?0+$/, "");
}

function formatRelativeScore(score: number) {
  const formatted = formatScore(score);
  if (score === 0) return "E";
  return score > 0 ? `+${formatted}` : formatted;
}

function parseTeeText(text: string): Omit<Tee, "id">[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const parMatch = line.match(/\bpar\s*[:=]?\s*(\d{2})\b/i);
    const ratingMatch = line.match(/\b(?:course\s*rating|cr)\s*[:=]?\s*(\d{2}[.,]\d)\b/i);
    const slopeMatch = line.match(/\bslope(?:\s*rating)?\s*[:=]?\s*(\d{2,3})\b/i);
    const numbers = [...line.matchAll(/\b\d{2,3}(?:[.,]\d)?\b/g)].map((match) => ({
      value: Number(match[0].replace(",", ".")),
      index: match.index ?? 0,
    }));
    const par = parMatch ? Number(parMatch[1]) : numbers.find((number) => Number.isInteger(number.value) && number.value >= 60 && number.value <= 80)?.value;
    const courseRating = ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : numbers.find((number) => !Number.isInteger(number.value) && number.value >= 60 && number.value <= 85)?.value;
    const slopeRating = slopeMatch ? Number(slopeMatch[1]) : numbers.find((number) => Number.isInteger(number.value) && number.value >= 80 && number.value <= 160)?.value;
    const firstValueIndex = parMatch?.index ?? numbers[0]?.index ?? -1;
    const name = (firstValueIndex < 0 ? "" : line.slice(0, firstValueIndex))
      .replace(/[\s:;,|/-]+$/, "")
      .replace(/^(?:tee|name)\s*[:=]?\s*/i, "")
      .trim();
    if (!name || typeof par !== "number" || !Number.isInteger(par) || par < 54 || par > 90
      || typeof courseRating !== "number" || !Number.isFinite(courseRating) || courseRating < 50 || courseRating > 100
      || typeof slopeRating !== "number" || !Number.isInteger(slopeRating) || slopeRating < 55 || slopeRating > 155) return [];
    return [{ name, par, courseRating, slopeRating }];
  });
}

function extractScoreFromText(text: string): number | undefined {
  const labelPattern = /\b(?:gross|score|total|totalt|samlet|brutto|slag)\b/i;
  const validNumber = (value: string) => {
    const score = Number(value);
    return Number.isInteger(score) && score >= 40 && score <= 180 ? score : undefined;
  };

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const labelMatch = line.match(labelPattern);
    if (!labelMatch) continue;

    const afterLabel = line.slice((labelMatch.index ?? 0) + labelMatch[0].length);
    const sameLineNumber = [...afterLabel.matchAll(/\b(\d{2,3})\b/g)].map((match) => validNumber(match[1])).find((score) => score !== undefined);
    if (sameLineNumber !== undefined) return sameLineNumber;

    for (const followingLine of lines.slice(index + 1, index + 3)) {
      const followingNumber = [...followingLine.matchAll(/\b(\d{2,3})\b/g)].map((match) => validNumber(match[1])).find((score) => score !== undefined);
      if (followingNumber !== undefined) return followingNumber;
    }
  }

  const labeled = [...text.matchAll(/\b(?:gross|score|total|totalt|samlet|brutto|slag)\b[^\d\r\n]{0,12}(\d{2,3})\b/gi)];
  for (let index = labeled.length - 1; index >= 0; index--) {
    const match = labeled[index];
    const score = validNumber(match[1]);
    if (score !== undefined) return score;
  }

  const candidates = [...text.matchAll(/\b(\d{2,3})\b/g)].map((match) => validNumber(match[1])).filter((score): score is number => score !== undefined);
  return candidates.at(-1);
}

async function preprocessTrackManImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = "createImageBitmap" in window
    ? await createImageBitmap(file)
    : await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not decode score image."));
      image.src = URL.createObjectURL(file);
    });

  const sourceWidth = bitmap instanceof HTMLImageElement ? bitmap.naturalWidth : bitmap.width;
  const sourceHeight = bitmap instanceof HTMLImageElement ? bitmap.naturalHeight : bitmap.height;
  const cropTop = Math.floor(sourceHeight * 0.25);
  const cropHeight = Math.max(1, Math.ceil(sourceHeight * 0.40));
  const scale = Math.max(1, 2000 / sourceWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(sourceWidth * scale);
  canvas.height = Math.ceil(cropHeight * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not create image processing canvas.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, cropTop, sourceWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  if ("close" in bitmap) bitmap.close();

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 2.4 + 128));
    const inverted = 255 - contrasted;
    pixels[index] = inverted;
    pixels[index + 1] = inverted;
    pixels[index + 2] = inverted;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

async function compressScorecardImage(file: File): Promise<string> {
  const bitmap = "createImageBitmap" in window
    ? await createImageBitmap(file)
    : await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not decode scorecard image."));
      };
      image.src = objectUrl;
    });
  const width = bitmap instanceof HTMLImageElement ? bitmap.naturalWidth : bitmap.width;
  const height = bitmap instanceof HTMLImageElement ? bitmap.naturalHeight : bitmap.height;
  if (!width || !height) throw new Error("Scorecard image has invalid dimensions.");
  const scale = Math.min(1, 1000 / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create scorecard image canvas.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if ("close" in bitmap) bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.65);
}

type TrackManScan = {
  playerName?: string;
  teeName?: string;
  courseName?: string;
  score?: number;
};

function extractTrackManInfo(text: string): TrackManScan {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const hcpIndex = lines.findIndex((line) => /\bHCP\b/i.test(line));
  const hcpLine = hcpIndex >= 0 ? lines[hcpIndex] : "";
  const hcpMatch = hcpLine.match(/\bHCP\b\s*[,:]?\s*[+-]?\d{1,2}\s*[,|]?\s*([A-Za-zÅÆØåæø][A-Za-zÅÆØåæø0-9 ._-]*)/i);
  const teeName = hcpMatch?.[1]?.replace(/[|]/g, "").trim();
  const playerName = hcpIndex > 0 ? lines[hcpIndex - 1] : undefined;

  const courseName = lines.find((line) =>
    /\b(?:resort|country club|golf club|golf|course|links)\b/i.test(line),
  );

  let score: number | undefined;
  if (playerName) {
    const playerLineIndex = lines.findIndex((line) => line.toLocaleLowerCase("nb").includes(playerName.toLocaleLowerCase("nb")));
    if (playerLineIndex >= 0) {
      const rowNumbers = [...lines[playerLineIndex].matchAll(/\b(\d{2,3})\b/g)]
        .map((match) => Number(match[1]))
        .filter((number) => number >= 40 && number <= 180);
      if (rowNumbers.length >= 2) score = rowNumbers[rowNumbers.length - 2];
      else if (rowNumbers.length === 1) score = rowNumbers[0];
    }
  }

  return { playerName, teeName, courseName, score };
}

function getCourseSetups(courses?: CourseSetup[]): CourseSetup[] {
  return defaultCourses.map((defaultCourse) =>
    courses?.find((course) => course.roundId === defaultCourse.roundId) ?? defaultCourse,
  );
}

function scoreEntries(roundId: number, data: TournamentData): ResultRow[] {
  const tournamentRounds = data.rounds ?? rounds;
  const round = tournamentRounds.find((item) => item.id === roundId);
  if (!round) return [];
  const tee = getTee(data.courses, roundId);
  const entries = data.scores.filter((score) => score.roundId === roundId).map((score) => {
    const scoreTee = getTee(data.courses, roundId, score.teeId) ?? tee;
    const team = data.teams.find((item) => item.id === score.entryId);
    if (team) {
      const playingHandicaps = team.playerIds
        .map((playerId) => data.players.find((player) => player.id === playerId))
        .filter((player): player is Player => player !== undefined)
        .map((player) => getPlayingHandicap(getTournamentHandicap(player, roundId, data), scoreTee ?? { id: "", name: "", par: round.par, courseRating: round.par, slopeRating: 113 }));
      const playingHandicap = playingHandicaps.length ? playingHandicaps.reduce((sum, value) => sum + value, 0) / playingHandicaps.length : 0;
      return {
        entryId: team.id,
        label: team.name,
        playerIds: [...team.playerIds],
        strokes: score.strokes,
        playingHandicap,
        netStrokes: Math.round((score.strokes - playingHandicap - (scoreTee?.par ?? round.par)) * 100) / 100,
        teeName: scoreTee?.name ?? "—",
        teePar: scoreTee?.par ?? round.par,
        score,
      };
    }
    const player = data.players.find((item) => item.id === score.entryId);
    if (!player) return null;
    const playingHandicap = scoreTee
      ? getPlayingHandicap(getTournamentHandicap(player, roundId, data), scoreTee)
      : getTournamentHandicap(player, roundId, data);
    return {
      entryId: player.id,
      label: player.name,
      playerIds: [player.id],
      strokes: score.strokes,
      playingHandicap,
      netStrokes: Math.round((score.strokes - playingHandicap - (scoreTee?.par ?? round.par)) * 100) / 100,
      teeName: scoreTee?.name ?? "—",
      teePar: scoreTee?.par ?? round.par,
      score,
    };
  }).filter((entry): entry is ResultRow => entry !== null).sort((a, b) => a.netStrokes - b.netStrokes);

  return entries;
}

function getLeaderboard(data: TournamentData) {
  const totals = new Map(data.players.map((player) => [player.id, {
    netScore: 0,
    roundsPlayed: 0,
    grossScore: 0,
    singleRoundsPlayed: 0,
  }]));
  for (const round of data.rounds ?? rounds) {
    for (const result of scoreEntries(round.id, data)) {
      for (const playerId of result.playerIds) {
        const total = totals.get(playerId);
        if (total) {
          total.netScore += result.netStrokes;
          total.roundsPlayed++;
          if (round.format === "Single" && result.playerIds.length === 1) {
            total.grossScore += result.strokes;
            total.singleRoundsPlayed++;
          }
        }
      }
    }
  }
  return data.players.map((player) => {
    const total = totals.get(player.id);
    return {
      player,
      netScore: total?.netScore ?? 0,
      roundsPlayed: total?.roundsPlayed ?? 0,
      averageGrossScore: total && total.singleRoundsPlayed > 0
        ? total.grossScore / total.singleRoundsPlayed
        : undefined,
    };
  }).sort((a, b) =>
    Number(b.roundsPlayed > 0) - Number(a.roundsPlayed > 0)
    || a.netScore - b.netScore
    || a.player.name.localeCompare(b.player.name, "nb"),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRoundFormat(value: string): value is RoundFormat {
  return ROUND_FORMATS.some((format) => format === value);
}

function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && ATTENDANCE_STATUSES.some((status) => status === value);
}

function isValidPlayer(value: unknown): value is Player {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.handicap === "number"
    && Number.isFinite(value.handicap)
    && value.handicap >= 0
    && value.handicap <= 54
    && (value.attendance === undefined || isAttendanceStatus(value.attendance))
    && (value.handicapOverrides === undefined || (isRecord(value.handicapOverrides)
      && Object.values(value.handicapOverrides).every((handicap) =>
        typeof handicap === "number" && Number.isFinite(handicap) && handicap >= 0 && handicap <= 54,
      )));
}

function isValidTeam(value: unknown): value is Team {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.roundId === "number"
    && Number.isInteger(value.roundId)
    && Array.isArray(value.playerIds)
    && value.playerIds.length === 2
    && value.playerIds.every((id) => typeof id === "string");
}

function isValidScore(value: unknown): value is Score {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.entryId === "string"
    && typeof value.roundId === "number"
    && Number.isInteger(value.roundId)
    && Number.isInteger(value.strokes)
    && typeof value.strokes === "number"
    && value.strokes >= 40
    && value.strokes <= 180
    && typeof value.updatedAt === "string"
    && (value.scorecardImage === undefined || (typeof value.scorecardImage === "string" && value.scorecardImage.startsWith("data:image/jpeg;base64,")))
    && (value.teeId === undefined || typeof value.teeId === "string");
}

function isValidTee(value: unknown): value is Tee {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.par === "number"
    && Number.isInteger(value.par)
    && value.par >= 54
    && value.par <= 90
    && typeof value.courseRating === "number"
    && Number.isFinite(value.courseRating)
    && value.courseRating >= 50
    && value.courseRating <= 100
    && typeof value.slopeRating === "number"
    && Number.isInteger(value.slopeRating)
    && value.slopeRating >= 55
    && value.slopeRating <= 155;
}

function isValidRound(value: unknown): value is Round {
  return isRecord(value)
    && typeof value.id === "number"
    && Number.isInteger(value.id)
    && typeof value.course === "string"
    && typeof value.format === "string"
    && isRoundFormat(value.format)
    && typeof value.startDate === "string"
    && typeof value.endDate === "string"
    && typeof value.location === "string"
    && typeof value.par === "number";
}

function isValidData(value: unknown): value is TournamentData {
  if (!isRecord(value) || !Array.isArray(value.players) || !Array.isArray(value.teams) || !Array.isArray(value.scores)) return false;
  if (value.playerRosterVersion !== undefined
    && (typeof value.playerRosterVersion !== "number" || !Number.isInteger(value.playerRosterVersion) || value.playerRosterVersion < 0)) return false;
  const optionalCoursesValid = value.courses === undefined || (Array.isArray(value.courses) && value.courses.every((course) =>
    isRecord(course) && typeof course.roundId === "number" && Array.isArray(course.tees) && course.tees.every(isValidTee),
  ));
  const optionalRoundsValid = value.rounds === undefined || (Array.isArray(value.rounds)   && value.rounds.length > 0
  && value.rounds.every(isValidRound));
  const optionalHouseRulesValid = value.houseRules === undefined
    || (typeof value.houseRules === "string" && value.houseRules.length <= 5000);
  return value.players.every(isValidPlayer)
    && value.teams.every(isValidTeam)
    && value.scores.every(isValidScore)
    && optionalCoursesValid
    && optionalRoundsValid
    && optionalHouseRulesValid;
}

function addInitialPlayers(data: TournamentData): TournamentData {
  if ((data.playerRosterVersion ?? 0) >= PLAYER_ROSTER_VERSION) return data;

  const players = [...data.players];
  for (const initialPlayer of initialPlayers) {
    const existingIndex = players.findIndex((player) =>
      player.id === initialPlayer.id
      || player.name.toLocaleLowerCase("nb") === initialPlayer.name.toLocaleLowerCase("nb"),
    );
    if (existingIndex !== -1) {
      const existing = players[existingIndex];
      if (existing.attendance === undefined) {
        players[existingIndex] = { ...existing, attendance: initialPlayer.attendance };
      }
      continue;
    }
    players.push(initialPlayer);
  }

  return { ...data, players, playerRosterVersion: PLAYER_ROSTER_VERSION };
}

function removeDemoData(data: TournamentData): TournamentData {
  const teams = data.teams.filter((team) =>
    !DEMO_TEAM_IDS.has(team.id) && team.playerIds.every((id) => !DEMO_PLAYER_IDS.has(id)),
  );
  const retainedTeamIds = new Set(teams.map((team) => team.id));

  return {
    players: data.players.filter((player) => !DEMO_PLAYER_IDS.has(player.id)),
    teams,
    courses: data.courses?.length ? data.courses : defaultCourses,
    rounds: data.rounds?.length ? data.rounds : rounds,
    playerRosterVersion: data.playerRosterVersion,
    houseRules: data.houseRules,
    scores: data.scores.filter((score) =>
      !DEMO_SCORE_IDS.has(score.id)
      && !DEMO_PLAYER_IDS.has(score.entryId)
      && !DEMO_TEAM_IDS.has(score.entryId)
      && (!data.teams.some((team) => team.id === score.entryId) || retainedTeamIds.has(score.entryId)),
    ),
  };
}

function getStatusLabel(status: ReturnType<typeof getRoundStatus>) {
  return status === "active" ? "Aktiv" : status === "completed" ? "Ferdig" : "Kommende";
}

function PlayerAvatar({ name, dark = false }: { name: string; dark?: boolean }) {
  return <span className={`player-avatar${dark ? " dark" : ""}`}>{initials(name)}</span>;
}

export default function Home() {
  const [data, setData] = useState<TournamentData>({ players: [], teams: [], scores: [], courses: defaultCourses, rounds });
  const [view, setView] = useState<View>("overview");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState(2);
  const [leaderboardRoundId, setLeaderboardRoundId] = useState(1);
  const [leaderboardMode, setLeaderboardMode] = useState<"overall" | "round">("overall");
  const [playerName, setPlayerName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamPlayerOne, setTeamPlayerOne] = useState("");
  const [teamPlayerTwo, setTeamPlayerTwo] = useState("");
  const [entryId, setEntryId] = useState("");
  const [strokes, setStrokes] = useState("");
  const [selectedTeeId, setSelectedTeeId] = useState(defaultCourses[1].tees[0].id);
  const [editingScoreId, setEditingScoreId] = useState("");
  const [scoreMethod, setScoreMethod] = useState<"manual" | "scan">("manual");
  const [isScanning, setIsScanning] = useState(false);
  const [scannedText, setScannedText] = useState("");
  const [scorecardImage, setScorecardImage] = useState("");
  const [lightboxScore, setLightboxScore] = useState<Score | null>(null);
  const [courseRoundId, setCourseRoundId] = useState(1);
  const [newTeeName, setNewTeeName] = useState("");
  const [pasteCourseText, setPasteCourseText] = useState("");
  const [parsedTees, setParsedTees] = useState<Omit<Tee, "id">[]>([]);
  const [golfifyUrl, setGolfifyUrl] = useState("");
  const [golfifyTees, setGolfifyTees] = useState<Omit<Tee, "id">[]>([]);
  const [isLoadingGolfify, setIsLoadingGolfify] = useState(false);
  const [houseRulesDraft, setHouseRulesDraft] = useState(DEFAULT_HOUSE_RULES);
  const scoreImageInput = useRef<HTMLInputElement>(null);
  const scoreImageUploadInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [editingPlayerId, setEditingPlayerId] = useState("");
  const [playerNameDraft, setPlayerNameDraft] = useState("");
  const [playerHandicapDraft, setPlayerHandicapDraft] = useState("");
  const [playerAttendanceDraft, setPlayerAttendanceDraft] = useState<AttendanceStatus>("Ja");
  const [overrideRoundId, setOverrideRoundId] = useState("1");
  const [overrideHandicapDraft, setOverrideHandicapDraft] = useState("");
  const [editingTeamId, setEditingTeamId] = useState("");
  const [editingRoundId, setEditingRoundId] = useState<number | null>(null);
  const [editingTeeId, setEditingTeeId] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isValidData(parsed)) {
          const cleaned = addInitialPlayers(removeDemoData(parsed));
          const savedCourses = cleaned.courses ?? [];
          const courses = defaultCourses.map((defaultCourse) =>
            savedCourses.find((course) => course.roundId === defaultCourse.roundId) ?? defaultCourse,
          );
          setData({ ...cleaned, courses, rounds: cleaned.rounds?.length ? cleaned.rounds : rounds });
        }
      } else {
        setData({
          players: initialPlayers,
          teams: [],
          scores: [],
          playerRosterVersion: PLAYER_ROSTER_VERSION,
          courses: defaultCourses,
          rounds,
        });
      }
    } catch (error) {
      console.error("Could not load tournament data from localStorage.", error);
    } finally {
      setReady(true);
    }
    try {
      setAdminUnlocked(window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "unlocked");
    } catch (error) {
      console.error("Could not read admin session state.", error);
      showToast("Kunne ikke lese admin-økten fra nettleseren.");
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...data,
        roundHandicaps: getTournamentHandicapSnapshot(data.players, data),
      }));
    } catch (error) {
      console.error("Could not save tournament data to localStorage.", error);
      showToast("Kunne ikke lagre endringen i nettleseren.");
    }
    // The timer is intentionally scoped to the current toast message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ready]);

  useEffect(() => {
    if (ready) setHouseRulesDraft(data.houseRules ?? DEFAULT_HOUSE_RULES);
  }, [data.houseRules, ready]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!lightboxScore) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxScore(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [lightboxScore]);

  const tournamentRounds = data.rounds ?? rounds;
  const selectedRound = tournamentRounds.find((round) => round.id === selectedRoundId) ?? tournamentRounds[0];
  const selectedRoundTeams = data.teams.filter((team) => team.roundId === selectedRoundId);
  const selectedEntries = isTeamFormat(selectedRound.format) ? selectedRoundTeams : data.players;
  const selectedCourse = getCourseSetup(data.courses, selectedRoundId);
  const selectedTee = selectedCourse.tees.find((tee) => tee.id === selectedTeeId) ?? selectedCourse.tees[0];
  const selectedEntry = selectedEntries.find((entry) => entry.id === entryId);
  const selectedPlayers = selectedEntry && isTeamFormat(selectedRound.format)
    ? (selectedEntry as Team).playerIds.map((id) => data.players.find((player) => player.id === id)).filter((player): player is Player => player !== undefined)
    : selectedEntry
      ? [selectedEntry as Player]
      : [];
  const selectedPlayerHandicaps = selectedPlayers.map((player) => getTournamentHandicap(player, selectedRoundId, data));
  const selectedPlayingHandicaps = selectedTee
    ? selectedPlayerHandicaps.map((handicap) => getPlayingHandicap(handicap, selectedTee))
    : [];
  const averagePlayingHandicap = selectedPlayingHandicaps.length
    ? selectedPlayingHandicaps.reduce((sum, handicap) => sum + handicap, 0) / selectedPlayingHandicaps.length
    : 0;
  const numericScore = Number(strokes);
  const validLiveScore = Number.isInteger(numericScore) && numericScore >= 40 && numericScore <= 180;
  const liveNetVsPar = validLiveScore && selectedTee && selectedPlayers.length
    ? numericScore - averagePlayingHandicap - selectedTee.par
    : undefined;
  const liveAdjustments = selectedPlayingHandicaps.map((handicap) =>
    validLiveScore && selectedTee
      ? Math.round((numericScore - handicap - selectedTee.par) / 2 * 10) / 10
      : undefined,
  );
  const liveNextHandicaps = selectedPlayerHandicaps.map((handicap, index) =>
    Math.round((handicap + (liveAdjustments[index] ?? 0)) * 10) / 10,
  );
  const results = useMemo(() => scoreEntries(selectedRoundId, data), [selectedRoundId, data]);
  const leaderboardResults = useMemo(() => scoreEntries(leaderboardRoundId, data), [leaderboardRoundId, data]);
  const overallLeaderboard = useMemo(() => getLeaderboard(data), [data]);
  const activeRound = tournamentRounds.find((round) => getRoundStatus(round) === "active");
  const nextRound = activeRound ?? tournamentRounds.find((round) => getRoundStatus(round) === "upcoming") ?? tournamentRounds[0];
  const finishedCount = tournamentRounds.filter((round) => getRoundStatus(round) === "completed").length;
  const activeCount = data.scores.length;
  const storageSizeBytes = JSON.stringify({
    ...data,
    roundHandicaps: getTournamentHandicapSnapshot(data.players, data),
  }).length * 2;

  function showToast(message: string) {
    setToast(message);
  }

  function handleAdminUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pinInput !== ADMIN_PIN) {
      setAdminError("Feil PIN-kode.");
      setPinInput("");
      return;
    }
    try {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, "unlocked");
      setAdminUnlocked(true);
      setShowPinPrompt(false);
      setPinInput("");
      setAdminError("");
      showToast("Admin-modus er aktiv.");
    } catch (error) {
      console.error("Could not save admin session state.", error);
      setAdminError("Kunne ikke lagre admin-økten i denne nettleseren.");
    }
  }

  function handleAdminLock() {
    try {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
      setAdminUnlocked(false);
      setEditingPlayerId("");
      setEditingTeamId("");
      setEditingRoundId(null);
      setEditingTeeId("");
      setShowPinPrompt(false);
      setPinInput("");
      setAdminError("");
      showToast("Admin-modus er låst.");
    } catch (error) {
      console.error("Could not clear admin session state.", error);
      showToast("Kunne ikke låse admin-modus. Prøv igjen.");
    }
  }

  function changeView(nextView: View) {
    setView(nextView);
    if (nextView === "scorecard") setSelectedRoundId(activeRound?.id ?? nextRound.id);
  }

  function selectRound(roundId: number) {
    setSelectedRoundId(roundId);
    setSelectedTeeId(getCourseSetup(data.courses, roundId).tees[0]?.id ?? "");
    setEntryId("");
    setStrokes("");
    setScorecardImage("");
    setEditingScoreId("");
  }

  function startEditingScore(score: Score) {
    if (!adminUnlocked) return;
    setView("scorecard");
    setSelectedRoundId(score.roundId);
    setEntryId(score.entryId);
    setStrokes(String(score.strokes));
    setScorecardImage(score.scorecardImage ?? "");
    setSelectedTeeId(score.teeId ?? getCourseSetup(data.courses, score.roundId).tees[0]?.id ?? "");
    setEditingScoreId(score.id);
  }

  function handleAddPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminUnlocked) return;
    const normalizedName = playerName.trim();
    const parsedHandicap = Number(handicap.replace(",", "."));
    if (!normalizedName || !Number.isFinite(parsedHandicap) || parsedHandicap < 0 || parsedHandicap > 54) {
      showToast("Skriv inn navn og et handicap mellom 0 og 54.");
      return;
    }
    if (data.players.some((player) => player.name.toLocaleLowerCase("nb") === normalizedName.toLocaleLowerCase("nb"))) {
      showToast("En spiller med dette navnet finnes allerede.");
      return;
    }
    const player = { id: crypto.randomUUID(), name: normalizedName, handicap: Math.round(parsedHandicap * 10) / 10, attendance: "Ja" as const };
    setData((current) => ({ ...current, players: [...current.players, player] }));
    setPlayerName("");
    setHandicap("");
    showToast(`${normalizedName} er lagt til i startfeltet.`);
  }

  function startEditingPlayer(player: Player) {
    setEditingPlayerId(player.id);
    setPlayerNameDraft(player.name);
    setPlayerHandicapDraft(player.handicap.toFixed(1));
    setPlayerAttendanceDraft(player.attendance ?? "Ja");
    setOverrideRoundId(String(nextRound.id));
    setOverrideHandicapDraft(player.handicapOverrides?.[String(nextRound.id)]?.toFixed(1) ?? "");
  }

  function handleSavePlayer(event: React.FormEvent<HTMLFormElement>, player: Player) {
    event.preventDefault();
    if (!adminUnlocked) return;
    const name = playerNameDraft.trim();
    const startHandicap = Number(playerHandicapDraft.replace(",", "."));
    const override = overrideHandicapDraft.trim() ? Number(overrideHandicapDraft.replace(",", ".")) : undefined;
    if (!name || !Number.isFinite(startHandicap) || startHandicap < 0 || startHandicap > 54
      || (override !== undefined && (!Number.isFinite(override) || override < 0 || override > 54))) {
      showToast("Skriv inn navn og gyldige handicapverdier mellom 0 og 54.");
      return;
    }
    if (data.players.some((item) => item.id !== player.id && item.name.toLocaleLowerCase("nb") === name.toLocaleLowerCase("nb"))) {
      showToast("En annen spiller med dette navnet finnes allerede.");
      return;
    }
    if (override === undefined && player.handicapOverrides?.[overrideRoundId] !== undefined
      && !window.confirm("Er du sikker på at du vil slette dette? Den manuelle handicap-overstyringen fjernes.")) return;
    const handicapOverrides = { ...player.handicapOverrides };
    if (override === undefined) delete handicapOverrides[overrideRoundId];
    else handicapOverrides[overrideRoundId] = Math.round(override * 10) / 10;
    setData((current) => ({
      ...current,
      players: current.players.map((item) => item.id === player.id
        ? { ...item, name, handicap: Math.round(startHandicap * 10) / 10, attendance: playerAttendanceDraft, handicapOverrides }
        : item),
    }));
    setEditingPlayerId("");
    showToast("Spiller og handicap er oppdatert.");
  }

  function handleDeletePlayer(player: Player) {
    if (!adminUnlocked || !window.confirm("Er du sikker på at du vil slette dette? Spilleren, lagene og tilhørende resultater fjernes.")) return;
    setData((current) => {
      const removedTeams = new Set(current.teams.filter((team) => team.playerIds.includes(player.id)).map((team) => team.id));
      return {
        ...current,
        players: current.players.filter((item) => item.id !== player.id),
        teams: current.teams.filter((team) => !removedTeams.has(team.id)),
        scores: current.scores.filter((score) => score.entryId !== player.id && !removedTeams.has(score.entryId)),
      };
    });
    if (editingPlayerId === player.id) setEditingPlayerId("");
    showToast(`${player.name} og tilhørende data er slettet.`);
  }

  function handleAddTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminUnlocked) return;
    if (!isTeamFormat(selectedRound.format)) {
      showToast("Velg en lagrunde før du setter sammen et lag.");
      return;
    }
    if (!teamPlayerOne || !teamPlayerTwo || teamPlayerOne === teamPlayerTwo) {
      showToast("Velg to forskjellige spillere til laget.");
      return;
    }
    if (selectedRoundTeams.some((team) => team.playerIds.includes(teamPlayerOne) || team.playerIds.includes(teamPlayerTwo))) {
      showToast("En av spillerne er allerede på et lag i denne runden.");
      return;
    }
    const first = data.players.find((player) => player.id === teamPlayerOne);
    const team: Team = {
      id: crypto.randomUUID(),
      roundId: selectedRoundId,
      name: teamName.trim() || `${first?.name.split(" ")[0] ?? "Lag"} & ${data.players.find((player) => player.id === teamPlayerTwo)?.name.split(" ")[0] ?? "partner"}`,
      playerIds: [teamPlayerOne, teamPlayerTwo],
    };
    setData((current) => ({ ...current, teams: [...current.teams, team] }));
    setTeamName("");
    setTeamPlayerOne("");
    setTeamPlayerTwo("");
    showToast(`${team.name} er klart for ${selectedRound.course}.`);
  }

  function handleSaveTeam(team: Team): boolean {
    if (!adminUnlocked) return false;
    const round = tournamentRounds.find((item) => item.id === team.roundId);
    if (!round || !isTeamFormat(round.format) || !team.name.trim()
      || team.playerIds[0] === team.playerIds[1]
      || team.playerIds.some((id) => !data.players.some((player) => player.id === id))) {
      showToast("Velg en gyldig lagrunde, et lagnavn og to forskjellige spillere.");
      return false;
    }
    const conflict = data.teams.some((item) =>
      item.id !== team.id && item.roundId === team.roundId
      && team.playerIds.some((playerId) => item.playerIds.includes(playerId)),
    );
    if (conflict) {
      showToast("En av spillerne er allerede på et annet lag i denne runden.");
      return false;
    }
    const movingScoredTeam = data.teams.find((item) => item.id === team.id)?.roundId !== team.roundId
      && data.scores.some((score) => score.entryId === team.id);
    if (movingScoredTeam && data.scores.some((score) =>
      score.roundId === team.roundId && score.entryId !== team.id
      && (team.playerIds.includes(score.entryId)
        || data.teams.some((item) => item.id === score.entryId && item.playerIds.some((id) => team.playerIds.includes(id)))),
    )) {
      showToast("Spilleren har allerede et scorekort i den valgte runden.");
      return false;
    }
    setData((current) => ({
      ...current,
      teams: current.teams.map((item) => item.id === team.id ? { ...team, name: team.name.trim() } : item),
      scores: current.scores.map((score) => score.entryId === team.id ? {
        ...score,
        roundId: team.roundId,
        teeId: getCourseSetup(current.courses, team.roundId).tees[0]?.id,
      } : score),
    }));
    setEditingTeamId("");
    showToast("Lagoppsettet er oppdatert.");
    return true;
  }

  function handleDeleteTeam(team: Team) {
    if (!adminUnlocked || !window.confirm("Er du sikker på at du vil slette dette? Tilhørende scorekort fjernes også.")) return;
    setData((current) => ({
      ...current,
      teams: current.teams.filter((item) => item.id !== team.id),
      scores: current.scores.filter((score) => score.entryId !== team.id),
    }));
    showToast(`${team.name} og tilhørende scorekort er slettet.`);
  }

  function handleSaveScore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingScoreId && !adminUnlocked) return;
    const parsedScore = Number(strokes);
    if (!entryId || !Number.isInteger(parsedScore) || parsedScore < 40 || parsedScore > 180) {
      showToast("Velg spiller/lag og skriv inn en gyldig score (40–180).");
      return;
    }
    if (!selectedTee) {
      showToast("Legg til et tee-sted før du registrerer resultat.");
      return;
    }
    const entryExists = selectedEntries.some((entry) => entry.id === entryId);
    if (!entryExists) {
      showToast("Spilleren eller laget finnes ikke i denne runden.");
      return;
    }
    const scoreTee = adminUnlocked ? selectedTee : selectedCourse.tees[0];
    if (!scoreTee) {
      showToast("Legg til et tee-sted før du registrerer resultat.");
      return;
    }
    const conflictingScore = data.scores.find((item) =>
      item.roundId === selectedRoundId && item.entryId === entryId && item.id !== editingScoreId,
    );
    if (conflictingScore && !window.confirm("Er du sikker på at du vil slette dette? Det registrerte resultatet erstattes av den nye scoren.")) return;
    const score: Score = {
      id: editingScoreId || crypto.randomUUID(),
      roundId: selectedRoundId,
      entryId,
      strokes: parsedScore,
      scorecardImage: scorecardImage || undefined,
      teeId: scoreTee.id,
      updatedAt: new Date().toISOString(),
    };
    setData((current) => ({
      ...current,
      scores: [...current.scores.filter((item) => item.id !== score.id && !(item.roundId === selectedRoundId && item.entryId === entryId)), score],
    }));
    setStrokes("");
    setScorecardImage("");
    setEditingScoreId("");
    showToast(editingScoreId ? "Resultatet er oppdatert. HCP-historikken er beregnet på nytt." : "Resultatet er lagret på scorekortet.");
  }

  async function handleSelectScorecardImage(file?: File, scan = false) {
    if (!file) return;
    try {
      const compressedImage = await compressScorecardImage(file);
      setScorecardImage(compressedImage);
      showToast("Scorekortbildet er komprimert og klart til lagring.");
      if (scan) await handleScanImage(file);
    } catch (error) {
      console.error("Could not compress scorecard image.", error);
      showToast("Kunne ikke behandle bildet. Prøv et annet bilde.");
    }
  }

  async function handleAdminScorecardImage(scoreId: string, file?: File) {
    if (!adminUnlocked || !file) return;
    try {
      const compressedImage = await compressScorecardImage(file);
      setData((current) => ({
        ...current,
        scores: current.scores.map((score) => score.id === scoreId ? { ...score, scorecardImage: compressedImage } : score),
      }));
      showToast("Scorekortbildet er lagret på resultatet.");
    } catch (error) {
      console.error("Could not update scorecard image.", error);
      showToast("Kunne ikke behandle bildet. Prøv et annet bilde.");
    }
  }

  function handleDeleteScorecardImage(score: Score) {
    if (!adminUnlocked || !score.scorecardImage || !window.confirm("Slette kun scorekortbildet? Resultatet beholdes.")) return;
    setData((current) => ({
      ...current,
      scores: current.scores.map((item) => item.id === score.id ? { ...item, scorecardImage: undefined } : item),
    }));
    showToast("Scorekortbildet er slettet. Resultatet er beholdt.");
  }

  function handleDeleteScore(score: Score) {
    if (!adminUnlocked || !window.confirm("Er du sikker på at du vil slette dette? Resultatet fjernes fra turneringen.")) return;
    setData((current) => ({ ...current, scores: current.scores.filter((item) => item.id !== score.id) }));
    if (editingScoreId === score.id) {
      setEditingScoreId("");
      setEntryId("");
      setStrokes("");
    }
    showToast("Resultatet er slettet. HCP-historikken er beregnet på nytt.");
  }

  function handleResetRoundScores(roundId: number) {
    if (!adminUnlocked || !window.confirm("Er du sikker på at du vil slette dette? Alle resultater i denne runden fjernes.")) return;
    setData((current) => ({ ...current, scores: current.scores.filter((score) => score.roundId !== roundId) }));
    setEditingScoreId("");
    setEntryId("");
    setStrokes("");
    showToast(`Resultatene for runde ${roundId} er nullstilt.`);
  }

  async function handleScanImage(file?: File) {
    if (!file) return;
    setIsScanning(true);
    setScannedText("");
    try {
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("eng");
      try {
        const processedImage = await preprocessTrackManImage(file);
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
        const { data: result } = await worker.recognize(processedImage);
        const text = result.text;
        setScannedText(text);
        const trackMan = extractTrackManInfo(text);
        const scannedScore = trackMan.score ?? extractScoreFromText(text);
        const normalizedText = text.toLocaleLowerCase("nb");
        const trackManTeeName = trackMan.teeName?.toLocaleLowerCase("nb") ?? "";
        const scannedTee = selectedCourse.tees.find((tee) => {
          const teeName = tee.name.toLocaleLowerCase("nb");
          return normalizedText.includes(teeName)
            || (trackManTeeName && (teeName.includes(trackManTeeName) || trackManTeeName.includes(teeName)));
        });
        const trackManPlayerName = trackMan.playerName?.toLocaleLowerCase("nb");
        const matchingPlayer = data.players.find((player) => {
          const playerName = player.name.toLocaleLowerCase("nb");
          return (trackManPlayerName && (trackManPlayerName.includes(playerName) || playerName.includes(trackManPlayerName)))
            || normalizedText.includes(playerName);
        });
        const matchingTeam = selectedRoundTeams.find((team) =>
          normalizedText.includes(team.name.toLocaleLowerCase("nb")),
        );
        if (scannedScore !== undefined) setStrokes(String(scannedScore));
        if (scannedTee && adminUnlocked) setSelectedTeeId(scannedTee.id);
        if (matchingPlayer) {
          setEntryId(isTeamFormat(selectedRound.format)
            ? selectedRoundTeams.find((team) => team.playerIds.includes(matchingPlayer.id))?.id ?? ""
            : matchingPlayer.id);
        } else if (matchingTeam) {
          setEntryId(matchingTeam.id);
        }
        if (scannedScore === undefined && !scannedTee && !matchingPlayer && !matchingTeam) {
          showToast("Fant ingen tydelige scoreverdier. Kontroller bildet eller fyll inn manuelt.");
        } else {
          showToast("Bildet er lest. Kontroller verdiene og lagre resultatet.");
        }
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      console.error("Could not read score image with OCR.", error);
      showToast("Kunne ikke lese bildet. Prøv et tydeligere bilde eller registrer manuelt.");
    } finally {
      setIsScanning(false);
    }
  }

  function handleAddTee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminUnlocked) return;
    const name = newTeeName.trim();
    if (!name) {
      showToast("Skriv inn et navn på tee-stedet.");
      return;
    }
    const setup = getCourseSetup(data.courses, courseRoundId);
    const coursePar = tournamentRounds.find((round) => round.id === courseRoundId)?.par ?? 72;
    const tee: Tee = { id: crypto.randomUUID(), name, par: coursePar, courseRating: coursePar, slopeRating: 113 };
    setData((current) => ({
      ...current,
      courses: getCourseSetups(current.courses).map((course) =>
        course.roundId === courseRoundId ? { ...course, tees: [...course.tees, tee] } : course,
      ),
    }));
    setNewTeeName("");
    if (courseRoundId === selectedRoundId && setup.tees.length === 0) setSelectedTeeId(tee.id);
    showToast(`${name} er lagt til.`);
  }

  function handleUpdateTee(roundId: number, tee: Tee) {
    if (!adminUnlocked) return;
    setData((current) => ({
      ...current,
      courses: getCourseSetups(current.courses).map((course) =>
        course.roundId === roundId
          ? { ...course, tees: course.tees.map((item) => item.id === tee.id ? tee : item) }
          : course,
      ),
    }));
    showToast("Tee-oppsettet er oppdatert.");
  }

  function handleDeleteTee(roundId: number, teeId: string) {
    if (!adminUnlocked) return;
    const setup = getCourseSetup(data.courses, roundId);
    if (setup.tees.length <= 1) {
      showToast("En bane må ha minst ett tee-sted.");
      return;
    }
    if (data.scores.some((score) =>
      score.roundId === roundId
      && (score.teeId === teeId || (!score.teeId && setup.tees[0]?.id === teeId)),
    )) {
      showToast("Tee-stedet brukes av et scorekort. Rediger verdiene i stedet for å slette det.");
      return;
    }
    if (!window.confirm("Er du sikker på at du vil slette dette? Tee-stedet fjernes fra banen.")) return;
    setData((current) => ({
      ...current,
      courses: getCourseSetups(current.courses).map((course) =>
        course.roundId === roundId ? { ...course, tees: course.tees.filter((tee) => tee.id !== teeId) } : course,
      ),
    }));
    if (roundId === selectedRoundId && selectedTeeId === teeId) {
      setSelectedTeeId(setup.tees.find((tee) => tee.id !== teeId)?.id ?? "");
    }
    showToast("Tee-stedet er fjernet.");
  }

  function handleParseCourseText() {
    if (!adminUnlocked) return;
    const parsed = parseTeeText(pasteCourseText);
    setParsedTees(parsed);
    if (!parsed.length) showToast("Fant ingen komplette tee-linjer. Bruk formatet: Hvit · Par 72 · CR 73,1 · Slope 132.");
  }

  async function handleFetchGolfifyTees() {
    if (!adminUnlocked) return;
    setIsLoadingGolfify(true);
    setGolfifyTees([]);
    try {
      const response = await fetch("/api/scrape-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: golfifyUrl }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = isRecord(result) && typeof result.error === "string" ? result.error : "Kunne ikke lese Golfify-siden.";
        throw new Error(message);
      }
      if (!isRecord(result) || !Array.isArray(result.tees)) {
        throw new Error("Golfify returnerte data i et ukjent format.");
      }
      const tees = result.tees.filter((tee): tee is Omit<Tee, "id"> =>
        isRecord(tee)
        && typeof tee.name === "string"
        && tee.name.trim().length > 0
        && typeof tee.par === "number"
        && Number.isInteger(tee.par)
        && typeof tee.courseRating === "number"
        && Number.isFinite(tee.courseRating)
        && typeof tee.slopeRating === "number"
        && Number.isInteger(tee.slopeRating),
      );
      if (!tees.length) throw new Error("Fant ingen gyldige tee-steder på siden.");
      setGolfifyTees(tees);
      showToast(`Fant ${tees.length} tee-steder. Kontroller verdiene og lagre.`);
    } catch (error) {
      console.error("Could not fetch Golfify course data.", error);
      showToast(error instanceof Error ? `Feil: ${error.message}` : "Feil: Kunne ikke lese siden.");
    } finally {
      setIsLoadingGolfify(false);
    }
  }

  function handleImportParsedTees(teesToImport = parsedTees) {
    if (!adminUnlocked) return;
    if (!teesToImport.length) return;
    if (getCourseSetup(data.courses, courseRoundId).tees.length > 0
      && !window.confirm("Er du sikker på at du vil slette dette? Importen erstatter tee-oppsettet som ikke brukes av scorekort.")) return;
    setData((current) => {
      const courses = getCourseSetups(current.courses).map((course) => {
        if (course.roundId !== courseRoundId) return course;
        const tees = teesToImport.map((tee) => {
          const existing = course.tees.find((item) => item.name.toLocaleLowerCase("nb") === tee.name.toLocaleLowerCase("nb"));
          return { ...tee, id: existing?.id ?? crypto.randomUUID() };
        });
        const importedIds = new Set(tees.map((tee) => tee.id));
        const usedTees = course.tees.filter((tee) =>
          current.scores.some((score) => score.roundId === courseRoundId
            && (score.teeId === tee.id || (!score.teeId && course.tees[0]?.id === tee.id)))
          && !importedIds.has(tee.id),
        );
        return { ...course, tees: [...tees, ...usedTees] };
      });
      return { ...current, courses };
    });
    setParsedTees([]);
    setGolfifyTees([]);
    setPasteCourseText("");
    showToast(`${teesToImport.length} tee-steder er lagret.`);
  }

  function handleSaveRound(round: Round) {
    if (!adminUnlocked) return;
    if (!round.course.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(round.startDate)
      || !/^\d{4}-\d{2}-\d{2}$/.test(round.endDate) || round.startDate > round.endDate) {
      showToast("Skriv inn banenavn og gyldige datoer i riktig rekkefølge.");
      return;
    }
    setData((current) => ({
      ...current,
      rounds: (current.rounds ?? rounds).map((item) => item.id === round.id ? { ...round, course: round.course.trim() } : item),
    }));
    setEditingRoundId(null);
    showToast(`Runde ${round.id} er oppdatert.`);
  }

  function handleSaveHouseRules(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminUnlocked) return;
    const rules = houseRulesDraft.trim();
    if (!rules) {
      showToast("Skriv inn husregler før du lagrer.");
      return;
    }
    if (rules.length > 5000) {
      showToast("Husreglene kan ikke være lengre enn 5000 tegn.");
      return;
    }
    setData((current) => ({ ...current, houseRules: rules }));
    setHouseRulesDraft(rules);
    showToast("Husreglene er lagret.");
  }

  function handleExportBackup() {
    if (!adminUnlocked) return;
    try {
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          ...data,
          courses: getCourseSetups(data.courses),
          rounds: tournamentRounds,
          roundHandicaps: getTournamentHandicapSnapshot(data.players, data),
        },
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `winter-tour-26-27-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Sikkerhetskopi er lastet ned.");
    } catch (error) {
      console.error("Could not export tournament backup.", error);
      showToast("Kunne ikke eksportere sikkerhetskopien.");
    }
  }

  async function handleImportBackup(file?: File) {
    if (!adminUnlocked || !file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const candidate = parsed && typeof parsed === "object" && "data" in parsed
        ? (parsed as { data: unknown }).data
        : parsed;
      if (!isValidData(candidate)) {
        showToast("Sikkerhetskopien har ugyldig format eller mangler turneringsdata.");
        return;
      }
      if (!window.confirm("Er du sikker på at du vil importere denne sikkerhetskopien? Nåværende data blir erstattet.")) return;
      const imported = addInitialPlayers(candidate);
      setData({
        ...imported,
        courses: getCourseSetups(imported.courses),
        rounds: imported.rounds?.length ? imported.rounds : rounds,
      });
      setEditingPlayerId("");
      setEditingTeamId("");
      setEditingRoundId(null);
      setEditingTeeId("");
      showToast("Sikkerhetskopien er importert.");
    } catch (error) {
      console.error("Could not import tournament backup.", error);
      showToast("Kunne ikke lese filen. Velg en gyldig Winter Tour JSON-sikkerhetskopi.");
    }
  }

  function handleResetTournament() {
    if (!adminUnlocked) return;
    if (!window.confirm("Er du sikker på at du vil slette dette? Alle registrerte resultater fjernes."))
      return;
    if (!window.confirm("Nullstill turneringen helt før runde 1? Dette kan ikke angres uten en sikkerhetskopi."))
      return;
    setData((current) => {
      const tournament = removeDemoData(current);
      return {
        ...tournament,
        players: tournament.players.map((player) => ({ ...player, handicapOverrides: undefined })),
        scores: [],
      };
    });
    setEditingPlayerId("");
    setEditingTeamId("");
    setEditingRoundId(null);
    showToast("Resultater og testscorer er nullstilt.");
  }

  const playerOptions = data.players.filter((player) => !selectedRoundTeams.some((team) => team.playerIds.includes(player.id)));

  return (
    <div className="app-shell">
      <header className="page-wrap topbar">
        <div className="brand">
          <img className="brand-mark" src="/icons/logo%20ny.jpg" alt="Winter Tour 26/27" />
        </div>
        <div className="topbar-right">
          <span className="season-pill"><CalendarDays size={13} /> 9 runder <span style={{ color: "#f15a24" }}>·</span> nov – mar</span>
          {adminUnlocked ? (
            <div className="admin-topbar"><span className="admin-status">Admin-modus aktiv</span><button className="admin-lock-button" type="button" onClick={handleAdminLock}><Lock size={13} /> Lås</button></div>
          ) : (
            <button className="admin-trigger" type="button" onClick={() => { setShowPinPrompt(true); setAdminError(""); }}><Lock size={13} /> Admin</button>
          )}
        </div>
      </header>

      <main className="page-wrap">
        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow">Sesongen 2026 — 2027</div>
            <h1>En vinter. Ni legendariske baner.</h1>
            <p className="hero-copy">Fra Utahs røde ørken til Atlanterhavets kyst. Samle gjengen, spill om æren og skriv neste kapittel i Winter Tour.</p>
            <div className="hero-bottom">
              <button className="primary-button" onClick={() => changeView("scorecard")}><Plus size={14} /> Registrer resultat</button>
            </div>
          </div>
        </section>

        <nav className="main-nav" aria-label="Hovedmeny">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item${view === id ? " active" : ""}`} onClick={() => changeView(id)}>
              <Icon size={14} strokeWidth={1.7} />{label}
            </button>
          ))}
        </nav>

        {adminUnlocked && (
          <section className="admin-toolbar" aria-label="Adminverktøy">
            <div className="admin-toolbar-copy"><strong>Adminverktøy</strong><span>Sikkerhetskopi og nullstilling av turneringsdata</span></div>
            <input ref={backupInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => { void handleImportBackup(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
            <div className="admin-toolbar-actions">
              <button className="secondary-button" type="button" onClick={handleExportBackup}><Download size={14} /> Eksporter sikkerhetskopi</button>
              <button className="secondary-button" type="button" onClick={() => backupInput.current?.click()}><Upload size={14} /> Importer sikkerhetskopi</button>
              <button className="admin-reset-button" type="button" onClick={handleResetTournament}><RotateCcw size={14} /> Nullstill alle resultater / testdata</button>
            </div>
            <div className="storage-meter">Lagringsplass brukt: {(storageSizeBytes / (1024 * 1024)).toFixed(2)} MB / 5.0 MB <span>(ca. estimat for turneringsdata)</span></div>
          </section>
        )}

        {showPinPrompt && !adminUnlocked && (
          <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowPinPrompt(false); setPinInput(""); setAdminError(""); } }}>
            <form className="pin-dialog" onSubmit={handleAdminUnlock} role="dialog" aria-modal="true" aria-labelledby="admin-pin-title">
              <button className="modal-close" type="button" aria-label="Lukk" onClick={() => { setShowPinPrompt(false); setPinInput(""); setAdminError(""); }}><X size={17} /></button>
              <span className="pin-icon"><Lock size={19} /></span>
              <h2 id="admin-pin-title">Admin</h2>
              <p>Skriv inn PIN-koden for å låse opp redigering.</p>
              <label className="visually-hidden" htmlFor="admin-pin">PIN-kode</label>
              <input id="admin-pin" autoFocus inputMode="numeric" type="password" maxLength={12} value={pinInput} onChange={(event) => setPinInput(event.target.value)} placeholder="PIN-kode" />
              {adminError && <span className="form-error" role="alert">{adminError}</span>}
              <button className="primary-button" type="submit"><Unlock size={14} /> Lås opp</button>
            </form>
          </div>
        )}
        {scorecardImage && (
          <div className="scorecard-upload-preview">
            <img src={scorecardImage} alt="Forhåndsvisning av scorekort" />
            <div><strong>Scorekortbilde klart</strong><span>{(new Blob([scorecardImage]).size / 1024).toFixed(0)} KB · JPEG</span>
              <button className="text-action danger-text" type="button" onClick={() => setScorecardImage("")}><Trash2 size={13} /> Fjern bilde</button>
            </div>
          </div>
        )}

        {view === "overview" && (
          <section className="panel panel-dark leader-card home-leaderboard">
            <div className="panel-head">
              <div><div className="panel-title">Leaderboard</div><div className="panel-kicker">Sammenlagt · alle runder</div></div>
              <button className="subtle-link" onClick={() => changeView("leaderboard")}>Se alle <ArrowRight size={15} /></button>
            </div>
            {data.scores.length === 0 ? (
              <div className="leader-empty">Sesongens første score venter.<br />Registrer et resultat for å komme i gang.</div>
            ) : overallLeaderboard.slice(0, 5).map(({ player, netScore, roundsPlayed }, index) => (
              <div className="leader-row" key={player.id}>
                <span className={`rank-number${index === 0 && roundsPlayed > 0 ? " gold" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
                <PlayerAvatar name={player.name} dark />
                <div className="leader-info"><div className="leader-name">{player.name}</div><div className="leader-sub">Start {player.handicap.toFixed(1)} · Nå {getTournamentHandicap(player, nextRound.id, data).toFixed(1)}</div></div>
                <div className="leader-total">{roundsPlayed ? formatRelativeScore(netScore) : "—"}<small>MOT PAR</small></div>
              </div>
            ))}
            <div className="note"><CircleHelp size={12} /> Lagets score mot par føres på begge spillerne.</div>
          </section>
        )}

        {view === "overview" && (
          <>
            <div className="section-heading">
              <div><div className="eyebrow">Sesongoversikt</div><h2>Velkommen til Winter Tour</h2><p>Alt du trenger for å følge sesongen — fra første utslag til siste putt.</p></div>
              <button className="subtle-link" onClick={() => changeView("players")}>Administrer spillere <ArrowRight size={14} /></button>
            </div>
            <div className="stats-grid">
              <StatCard label="Spillere" value={data.players.length.toString().padStart(2, "0")} note="I startfeltet" icon={<Users size={15} />} />
              <StatCard label="Turneringsrunder" value="09" note="Nov 2026 — mar 2027" icon={<Flag size={15} />} />
              <StatCard label="Registrerte scorekort" value={activeCount.toString().padStart(2, "0")} note="Resultater i systemet" icon={<Medal size={15} />} />
              <StatCard label="Ferdigspilt" value={`${finishedCount} / 9`} note="Runder denne sesongen" icon={<Trophy size={15} />} />
            </div>
            <div className="overview-grid">
              <section className="panel">
                <div className="panel-head"><div><div className="panel-title">Turneringsprogram</div><div className="panel-kicker">Ni stopp. Én mester.</div></div><button className="subtle-link" onClick={() => changeView("scorecard")}>Scorekort <ArrowRight size={13} /></button></div>
                <div className="round-list">
                  {tournamentRounds.map((round) => <div className="round-admin-row" key={round.id}>
                    <RoundRow round={round} scores={data.scores} active={round.id === nextRound.id} admin={adminUnlocked} onEdit={() => setEditingRoundId(round.id)} onSelect={() => { selectRound(round.id); setView("scorecard"); }} />
                    {adminUnlocked && editingRoundId === round.id && <RoundEditor round={round} onSave={handleSaveRound} onCancel={() => setEditingRoundId(null)} />}
                  </div>)}
                </div>
              </section>
            </div>
          </>
        )}

        {view === "players" && (
          <section className="content-section">
            <SectionHeading eyebrow="Startfeltet" title="Spillere & lag" description="Legg til spillere og sett sammen par for hver lagrunde." />
            <div className="content-panel">
              <div className="content-panel-header"><div><h3>Legg til spiller</h3><p>Start-HCP brukes som grunnlag for handicaputviklingen gjennom turneringen.</p></div><span className="season-pill"><Users size={13} /> {data.players.length} spillere</span></div>
              {adminUnlocked ? <form className="form-row" onSubmit={handleAddPlayer}>
                  <div className="field" style={{ flex: 2 }}><label htmlFor="player-name">Spillernavn</label><input id="player-name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="F.eks. Alex Hansen" /></div>
                  <div className="field" style={{ maxWidth: 140 }}><label htmlFor="player-hcp">Start-HCP</label><input id="player-hcp" type="number" min="0" max="54" step="0.1" value={handicap} onChange={(event) => setHandicap(event.target.value)} placeholder="12.4" /></div>
                  <button className="primary-button" type="submit"><Plus size={14} /> Legg til</button>
                </form> : <div className="admin-locked-note"><Lock size={13} /> Lås opp Admin for å legge til, redigere eller slette spillere.</div>}
              <div className="player-list">
                {data.players.map((player) => {
                  const currentHandicap = getTournamentHandicap(player, nextRound.id, data);
                  const history = getHandicapHistory(player, data);
                  return (
                    <article className="player-card player-card-expanded" key={player.id}>
                      <PlayerAvatar name={player.name} dark />
                      <div className="player-card-main">
                        <div className="player-card-name">{player.name}</div>
                        <div className="player-card-meta">Med {player.attendance ?? "Ja"} · Start-HCP {player.handicap.toFixed(1)} · Turnerings-HCP {currentHandicap.toFixed(1)}</div>
                        {adminUnlocked && <div className="entry-actions">
                          <button className="text-action" type="button" onClick={() => startEditingPlayer(player)}><Pencil size={13} /> Rediger</button>
                          <button className="text-action danger-text" type="button" onClick={() => handleDeletePlayer(player)}><Trash2 size={13} /> Slett</button>
                        </div>}
                        {adminUnlocked && editingPlayerId === player.id && <form className="admin-edit-form" onSubmit={(event) => handleSavePlayer(event, player)}>
                          <div className="field"><label htmlFor={`edit-player-name-${player.id}`}>Spillernavn</label><input id={`edit-player-name-${player.id}`} value={playerNameDraft} onChange={(event) => setPlayerNameDraft(event.target.value)} required /></div>
                          <div className="field"><label htmlFor={`edit-player-hcp-${player.id}`}>Start-HCP</label><input id={`edit-player-hcp-${player.id}`} type="number" min="0" max="54" step="0.1" value={playerHandicapDraft} onChange={(event) => setPlayerHandicapDraft(event.target.value)} required /></div>
                          <div className="field"><label htmlFor={`edit-player-attendance-${player.id}`}>Med</label><select id={`edit-player-attendance-${player.id}`} value={playerAttendanceDraft} onChange={(event) => { const status = ATTENDANCE_STATUSES.find((item) => item === event.target.value); if (status) setPlayerAttendanceDraft(status); }}>{ATTENDANCE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                          <div className="field"><label htmlFor={`override-round-${player.id}`}>Overstyr Turnerings-HCP for</label><select id={`override-round-${player.id}`} value={overrideRoundId} onChange={(event) => { setOverrideRoundId(event.target.value); setOverrideHandicapDraft(player.handicapOverrides?.[event.target.value]?.toFixed(1) ?? ""); }}>{tournamentRounds.map((round) => <option key={round.id} value={round.id}>Runde {round.id}</option>)}</select></div>
                          <div className="field"><label htmlFor={`override-hcp-${player.id}`}>Manuell HCP (tomt = automatisk)</label><input id={`override-hcp-${player.id}`} type="number" min="0" max="54" step="0.1" value={overrideHandicapDraft} onChange={(event) => setOverrideHandicapDraft(event.target.value)} placeholder="Automatisk" /></div>
                          <div className="admin-edit-actions"><button className="secondary-button" type="submit"><Save size={13} /> Lagre</button><button className="text-action" type="button" onClick={() => setEditingPlayerId("")}>Avbryt</button></div>
                        </form>}
                        <details className="hcp-history">
                          <summary>HCP-historikk per runde</summary>
                          <div className="hcp-history-list">
                            {history.map((item) => (
                              <span key={item.roundId} className="hcp-history-item">
                                R{item.roundId}: {item.handicap.toFixed(1)}
                                {item.adjustment !== undefined && <small>{item.adjustment > 0 ? "+" : ""}{item.adjustment.toFixed(1)}</small>}
                                {player.handicapOverrides?.[item.roundId] !== undefined && <small>manuell</small>}
                              </span>
                            ))}
                          </div>
                        </details>
                        <details className="hcp-history">
                          <summary>Resultathistorikk</summary>
                          <div className="player-score-history">
                            {data.scores.filter((score) => {
                              if (score.entryId === player.id) return true;
                              const team = data.teams.find((item) => item.id === score.entryId && item.roundId === score.roundId);
                              return team?.playerIds.includes(player.id) ?? false;
                            }).sort((a, b) => a.roundId - b.roundId).map((score) => {
                              const round = tournamentRounds.find((item) => item.id === score.roundId);
                              return <div className="player-score-history-row" key={score.id}>
                                <span>Runde {score.roundId} · {round?.course ?? "Ukjent bane"} · {score.strokes} slag</span>
                                {score.scorecardImage && <button className="scorecard-view-button" type="button" onClick={() => setLightboxScore(score)}><Camera size={13} /> Se scorekort</button>}
                              </div>;
                            })}
                            {!data.scores.some((score) => score.entryId === player.id || data.teams.some((team) => team.id === score.entryId && team.roundId === score.roundId && team.playerIds.includes(player.id))) && <span>Ingen registrerte resultater ennå.</span>}
                          </div>
                        </details>
                      </div>
                      <div className="hcp">{currentHandicap.toFixed(1)}<small style={{ display: "block", color: "#72777c", font: "8px Arial", textAlign: "right", marginTop: 3 }}>NÅVÆRENDE</small></div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="content-panel" style={{ marginTop: 15 }}>
              <div className="content-panel-header"><div><h3>Lagoppstilling</h3><p>Opprett 2-mannslag for valgt runde. Hver spiller kan kun være på ett lag per runde.</p></div><span className="team-icon"><Users size={16} /></span></div>
              {adminUnlocked ? <form className="team-builder" onSubmit={handleAddTeam}>
                  <div className="field"><label htmlFor="team-round">Velg lagrunde</label><select id="team-round" value={selectedRoundId} onChange={(event) => { selectRound(Number(event.target.value)); setTeamPlayerOne(""); setTeamPlayerTwo(""); }}><option value="" disabled>Velg runde</option>{tournamentRounds.filter((round) => isTeamFormat(round.format)).map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course} ({round.format})</option>)}</select></div>
                  <div className="field"><label htmlFor="team-first">Spiller 1</label><select id="team-first" value={teamPlayerOne} onChange={(event) => setTeamPlayerOne(event.target.value)}><option value="">Velg spiller</option>{playerOptions.filter((player) => player.id !== teamPlayerTwo).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
                  <div className="field"><label htmlFor="team-second">Spiller 2</label><select id="team-second" value={teamPlayerTwo} onChange={(event) => setTeamPlayerTwo(event.target.value)}><option value="">Velg spiller</option>{playerOptions.filter((player) => player.id !== teamPlayerOne).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
                  <button className="primary-button" type="submit"><Plus size={14} /> Opprett lag</button>
                </form> : <div className="admin-locked-note"><Lock size={13} /> Lås opp Admin for å opprette, redigere eller slette lag.</div>}
              {selectedRoundTeams.length ? (
                <div className="team-list">{selectedRoundTeams.map((team) => editingTeamId === team.id && adminUnlocked
                  ? <TeamEditor key={team.id} team={team} players={data.players} rounds={tournamentRounds} teams={data.teams} onSave={handleSaveTeam} onCancel={() => setEditingTeamId("")} />
                  : <TeamCard key={team.id} team={team} players={data.players} admin={adminUnlocked} onEdit={() => setEditingTeamId(team.id)} onDelete={() => handleDeleteTeam(team)} />)}</div>
              ) : <div className="empty-state">Ingen lag for {selectedRound.course} ennå. Velg to spillere for å opprette det første laget.</div>}
            </div>
          </section>
        )}

        {view === "scorecard" && (
          <section className="content-section">
            <SectionHeading eyebrow="Rundens scorekort" title="Registrer resultat" description="Legg inn brutto slag. Laveste score mot par vinner runden." />
            <div className="score-layout">
              <section className="content-panel">
                <div className="content-panel-header"><div><h3>{editingScoreId ? "Rediger resultat" : "Registrer resultat"}</h3><p>Resultatene lagres automatisk på denne enheten.</p></div><Medal size={17} color="#f15a24" /></div>
                <div className="score-methods" role="tablist" aria-label="Registreringsmetode">
                  <button type="button" className={`segment${scoreMethod === "manual" ? " selected" : ""}`} onClick={() => setScoreMethod("manual")} role="tab" aria-selected={scoreMethod === "manual"}>Manuell registrering</button>
                </div>
                <form className="score-form" onSubmit={handleSaveScore}>
                  <div className="field"><label htmlFor="score-round">Runde / bane</label><select id="score-round" value={selectedRoundId} onChange={(event) => {
                      const roundId = Number(event.target.value);
                      setSelectedRoundId(roundId);
                      setSelectedTeeId(getCourseSetup(data.courses, roundId).tees[0]?.id ?? "");
                      setEntryId("");
                    }}><option value="" disabled>Velg runde</option>{tournamentRounds.map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course}</option>)}</select></div>
                  <div className="field"><label htmlFor="score-tee">Tee-sted</label><select id="score-tee" value={selectedTee?.id ?? ""} disabled={!adminUnlocked} onChange={(event) => {
                    if (adminUnlocked) setSelectedTeeId(event.target.value);
                  }}><option value="">Velg tee</option>{selectedCourse.tees.map((tee) => <option key={tee.id} value={tee.id}>{tee.name} · Par {tee.par} · CR {tee.courseRating.toFixed(1)} · Slope {tee.slopeRating}</option>)}</select>{!adminUnlocked && <p style={{ color: "#72777c", fontSize: 11, margin: "6px 0 0" }}>Kun Admin kan velge tee-sted.</p>}</div>
                  <div className="field"><label htmlFor="score-player">{isTeamFormat(selectedRound.format) ? "Lag" : "Spiller"}</label><select id="score-player" value={entryId} onChange={(event) => setEntryId(event.target.value)}><option value="">Velg {isTeamFormat(selectedRound.format) ? "lag" : "spiller"}</option>{selectedEntries.map((entry) => <option key={entry.id} value={entry.id}>{isTeamFormat(selectedRound.format) ? (entry as Team).name : (entry as Player).name}</option>)}</select></div>
                  <div className="field"><label htmlFor="score-strokes">Brutto slag</label><input id="score-strokes" type="number" min="40" max="180" step="1" value={strokes} onChange={(event) => setStrokes(event.target.value)} placeholder={`Par ${selectedRound.par} · f.eks. 74`} /></div>
                  {selectedPlayers.length > 0 && selectedTee && (
                    <div className="score-preview">
                      <div><span>Turnerings-HCP</span><strong>{selectedPlayerHandicaps.map((hcp) => hcp.toFixed(1)).join(" / ")}</strong></div>
                      <div><span>Spillehandicap</span><strong>{selectedPlayingHandicaps.join(" / ")}</strong></div>
                      {liveNetVsPar !== undefined && <>
                        <div><span>Netto mot par</span><strong>{formatRelativeScore(liveNetVsPar)}</strong></div>
                        <div><span>HCP neste runde</span><strong>{liveNextHandicaps.map((hcp) => hcp.toFixed(1)).join(" / ")}</strong></div>
                        <p>{liveAdjustments.map((adjustment) => adjustment === undefined ? "—" : `${adjustment > 0 ? "+" : ""}${adjustment.toFixed(1)}`).join(" / ")} justering før neste runde.</p>
                      </>}
                    </div>
                  )}
                  {isTeamFormat(selectedRound.format) && selectedRoundTeams.length === 0 && <div className="leader-empty" style={{ padding: "3px 0 13px", textAlign: "left" }}>Ingen lag er satt opp for denne runden. <button className="subtle-link" style={{ display: "inline-flex", padding: 0 }} type="button" onClick={() => setView("players")}>Opprett lag <ArrowRight size={12} /></button></div>}
                  <button className="primary-button" type="submit"><Check size={14} /> {editingScoreId ? "Oppdater resultat" : "Lagre resultat"}</button>
                  {editingScoreId && <button className="secondary-button cancel-edit" type="button" onClick={() => { setEditingScoreId(""); setEntryId(""); setStrokes(""); setScorecardImage(""); }}>Avbryt redigering</button>}
                </form>
              </section>
              <section className="content-panel">
                <div className="content-panel-header"><div><h3>Runde {selectedRound.id} · {selectedRound.course}</h3><p>{formatPeriod(selectedRound)} · {selectedRound.format} · Par {selectedTee?.par ?? selectedRound.par}</p></div><div className="scorecard-admin-actions"><span className={`status ${getRoundStatus(selectedRound)}`}>{getStatusLabel(getRoundStatus(selectedRound))}</span>{adminUnlocked && results.length > 0 && <button className="admin-reset-button" type="button" onClick={() => handleResetRoundScores(selectedRoundId)}><RotateCcw size={13} /> Nullstill runden</button>}</div></div>
                {results.length ? <ScoreResults
                  results={results}
                  players={data.players}
                  admin={adminUnlocked}
                  onEdit={startEditingScore}
                  onDelete={handleDeleteScore}
                  onViewImage={setLightboxScore}
                  onImageUpload={handleAdminScorecardImage}
                  onDeleteImage={handleDeleteScorecardImage}
                /> : <div className="empty-state">Scorekortet er tomt ennå.<br />Legg inn første resultat for å se rundens leaderboard.</div>}
              </section>
            </div>
            <section className="content-panel scorecard-gallery">
              <div className="content-panel-header"><div><h3>Opplastede scorekort for runden</h3><p>Runde {selectedRound.id} · {selectedRound.course}</p></div><Camera size={17} color="#f15a24" /></div>
              {results.filter((result) => result.score.scorecardImage).length ? (
                <div className="scorecard-gallery-grid">{results.filter((result) => result.score.scorecardImage).map((result) => (
                  <button className="scorecard-gallery-card" type="button" key={result.score.id} onClick={() => setLightboxScore(result.score)}>
                    <img src={result.score.scorecardImage} alt={`Scorekort for ${result.label}`} />
                    <span><strong><Camera size={13} /> Se scorekort</strong>{result.label} · {result.strokes} slag</span>
                  </button>
                ))}</div>
              ) : <div className="empty-state">Ingen bilder er lastet opp for denne runden ennå.</div>}
            </section>
          </section>
        )}

        {view === "leaderboard" && (
          <section className="content-section">
            <SectionHeading eyebrow="Kampen om tittelen" title="Leaderboard" description="Spillerne rangeres etter summen av netto score mot par fra registrerte runder, lavest først. Lagresultat føres på begge spillerne." />
            <section className="content-panel">
              <div className="leaderboard-controls">
                <div className="segmented" role="tablist" aria-label="Leaderboard-visning">
                  <button className={`segment${leaderboardMode === "overall" ? " selected" : ""}`} onClick={() => setLeaderboardMode("overall")} role="tab" aria-selected={leaderboardMode === "overall"}>Sammenlagt</button>
                  <button className={`segment${leaderboardMode === "round" ? " selected" : ""}`} onClick={() => setLeaderboardMode("round")} role="tab" aria-selected={leaderboardMode === "round"}>Runderesultat</button>
                </div>
                {leaderboardMode === "round" && <div className="field" style={{ minWidth: 215, flex: "0 1 270px" }}><label htmlFor="leader-round">Velg runde</label><select id="leader-round" value={leaderboardRoundId} onChange={(event) => setLeaderboardRoundId(Number(event.target.value))}><option value="" disabled>Velg runde</option>{tournamentRounds.map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course}</option>)}</select></div>}
              </div>
              {leaderboardMode === "overall" ? (
                <>
                  <div className="score-table-wrap"><table className="leaderboard-table"><thead><tr><th>Plass</th><th>Spiller</th><th>Score</th><th>Snitt brutto (singel)</th><th>Start-HCP</th><th>Turnerings-HCP</th></tr></thead><tbody>
                    {overallLeaderboard.map(({ player, netScore, roundsPlayed, averageGrossScore }, index) => <tr key={player.id}><td className={index === 0 && roundsPlayed > 0 ? "trophy-rank" : "table-rank"}>{String(index + 1).padStart(2, "0")}{index === 0 && roundsPlayed > 0 ? "  ♛" : ""}</td><td><span className="player-inline"><PlayerAvatar name={player.name} dark />{player.name}</span></td><td className="leader-total-cell">{roundsPlayed ? formatRelativeScore(netScore) : "—"}</td><td>{averageGrossScore === undefined ? "—" : formatScore(averageGrossScore)}</td><td className="result-label">{player.handicap.toFixed(1)}</td><td>{getTournamentHandicap(player, nextRound.id, data).toFixed(1)}</td></tr>)}
                  </tbody></table></div>
                  <div className="leaderboard-foot">Score er summen av netto score mot par fra registrerte runder; lavest sum vinner. Snitt brutto beregnes kun fra spillerens registrerte singelrunder. Lagresultater føres på begge spillerne.</div>
                </>
              ) : leaderboardResults.length ? (
                <>
                  <ScoreResults results={leaderboardResults} players={data.players} admin={adminUnlocked} onEdit={startEditingScore} onDelete={handleDeleteScore} onViewImage={setLightboxScore} onImageUpload={handleAdminScorecardImage} onDeleteImage={handleDeleteScorecardImage} />
                  <div className="leaderboard-foot">Rundens netto score mot par = brutto slag − spille-HCP − banepar; lavest score vinner runden.</div>
                </>
              ) : <div className="empty-state">Ingen resultater registrert for denne runden ennå.</div>}
            </section>
          </section>
        )}

        {view === "rules" && (
          <section className="content-section rules-page">
            <SectionHeading eyebrow="Winter Tour 26/27" title="Regler & spilleformater" description="Slik spiller vi og beregner handicap gjennom vintersesongen." />

            <section className="rules-panel">
              <div className="rules-panel-heading"><span className="rules-icon"><Trophy size={17} /></span><div><h3>Turneringsformat</h3><p>Ni runder gjennom vinteren 2026/2027.</p></div></div>
              <div className="rules-panel-content">
                <p>Turneringen avgjøres av summen av netto slag til par fra alle registrerte runder. Laveste totalsum vinner.</p>
                <p>I par-runder gjelder lagets netto resultat for begge spillerne.</p>
              </div>
            </section>

            <section className="rules-panel">
              <div className="rules-panel-heading"><span className="rules-icon"><Users size={17} /></span><div><h3>Spilleformater</h3><p>Formatet for hver runde står også i turneringsoversikten.</p></div></div>
              <div className="rules-accordion">
                <details open>
                  <summary>Single · Individuell slagspill</summary>
                  <p>Hver spiller spiller sin egen ball fra tee til hull. Laveste netto score vinner.</p>
                </details>
                <details>
                  <summary>Greensome</summary>
                  <p>Begge på laget slår ut fra tee. Laget velger den beste utslagsballen, og spillerne slår deretter annenhvert slag på samme ball til den er i hullet.</p>
                </details>
                <details>
                  <summary>Scramble</summary>
                  <p>Begge slår ut fra tee og velger den beste ballen. Begge slår neste slag fra samme posisjon. Slik fortsetter laget helt til ballen er i hullet.</p>
                </details>
                <details>
                  <summary>Best Ball · Fourball</summary>
                  <p>Begge spillerne spiller sin egen ball gjennom hele hullet. Lagets score på hvert hull er den beste netto scoren av de to spillerne.</p>
                </details>
                <details>
                  <summary>Foursome</summary>
                  <p>Laget spiller én felles ball og slår annenhvert slag helt til ballen er i hullet. Spiller A slår ut på alle oddetallshull, spiller B på alle partallshull.</p>
                </details>
              </div>
            </section>

            <section className="rules-panel">
              <div className="rules-panel-heading"><span className="rules-icon"><Flag size={17} /></span><div><h3>Handicap-system & dynamisk justering</h3><p>HCP beregnes på nytt etter hver registrerte runde.</p></div></div>
              <div className="rules-panel-content">
                <ul className="rules-list">
                  <li><strong>Start-HCP:</strong> Hver spiller starter turneringen med sitt utendørs handicap.</li>
                  <li><strong>Spillehandicap (SHCP):</strong> Turnerings-HCP × (Slope / 113) + (Course Rating − Par), avrundet til nærmeste heltall for valgt tee.</li>
                  <li><strong>Justering etter runden:</strong> Netto resultat mot par deles på 2 og legges til Turnerings-HCP. Justeringen avrundes til én desimal før neste runde.</li>
                </ul>
                <div className="rules-example"><strong>Eksempel</strong><p>Spiller du −2 netto på en runde, justeres handicappet ditt ned med −1.0 før neste runde. Spiller du +4 netto, justeres det opp med +2.0.</p></div>
              </div>
            </section>

            <section className="rules-panel">
              <div className="rules-panel-heading"><span className="rules-icon"><ClipboardList size={17} /></span><div><h3>Slik registrerer du score</h3><p>Registrer resultatet etter runden og kontroller tallene før lagring.</p></div></div>
              <div className="rules-panel-content">
                <ol className="rules-steps">
                  <li><strong>Velg runde og spiller/lag</strong><span>Åpne Scorekort og velg riktig runde og spiller eller lag.</span></li>
                  <li><strong>Legg inn brutto score</strong><span>Registrer manuelt, eller velg «Skann scorekort» og ta bilde eller last opp bilde av TrackMan-skjermen.</span></li>
                  <li><strong>Kontroller og lagre</strong><span>Kontroller at tee-sted og brutto score stemmer, og lagre resultatet.</span></li>
                </ol>
              </div>
              <div className="rules-house">
                <div className="rules-house-heading"><h4>Simulator- & husregler</h4>{adminUnlocked && <span>Admin kan redigere</span>}</div>
                {adminUnlocked ? (
                  <form onSubmit={handleSaveHouseRules}>
                    <label className="visually-hidden" htmlFor="house-rules">Simulator- og husregler</label>
                    <textarea id="house-rules" value={houseRulesDraft} maxLength={5000} onChange={(event) => setHouseRulesDraft(event.target.value)} rows={4} />
                    <div className="rules-house-actions"><small>{houseRulesDraft.length}/5000 tegn</small><button className="primary-button" type="submit"><Save size={13} /> Lagre husregler</button></div>
                  </form>
                ) : (
                  <p className="rules-house-text">{data.houseRules || DEFAULT_HOUSE_RULES}</p>
                )}
              </div>
            </section>
          </section>
        )}

        {view === "courses" && (
          <section className="content-section">
            <SectionHeading eyebrow="Baneoppsett" title="Baner & Tee-oppsett" description="Administrer Par, Course Rating og Slope for alle ni rundene." />
            <section className="content-panel">
              <div className="content-panel-header">
                <div><h3>Velg bane</h3><p>Standardverdiene er veiledende startverdier og kan overskrives med klubbens offisielle tall.</p></div>
                <Flag size={17} color="#f15a24" />
              </div>
              <div className="form-row">
                <div className="field"><label htmlFor="course-round">Turneringsbane</label><select id="course-round" value={courseRoundId} onChange={(event) => { setCourseRoundId(Number(event.target.value)); setParsedTees([]); setGolfifyTees([]); }}><option value="" disabled>Velg bane</option>{tournamentRounds.map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course}</option>)}</select></div>
                <div className="course-default-note">Veiledende standardverdier · Par {tournamentRounds.find((round) => round.id === courseRoundId)?.par ?? 72}</div>
              </div>
              <form className="form-row add-tee-form" onSubmit={handleAddTee}>
                {adminUnlocked ? <>
                  <div className="field"><label htmlFor="new-tee-name">Nytt tee-sted</label><input id="new-tee-name" value={newTeeName} onChange={(event) => setNewTeeName(event.target.value)} placeholder="F.eks. Gull · 5 800 m" /></div>
                  <button className="primary-button" type="submit"><Plus size={14} /> Legg til tee</button>
                </> : <div className="admin-locked-note"><Lock size={13} /> Lås opp Admin for å legge til, redigere eller slette tee-steder.</div>}
              </form>
              <div className="tee-list">
                {getCourseSetup(data.courses, courseRoundId).tees.map((tee) => (
                  <TeeEditor
                    key={tee.id}
                    tee={tee}
                    admin={adminUnlocked}
                    editing={editingTeeId === tee.id}
                    onEdit={() => setEditingTeeId(tee.id)}
                    onCancel={() => setEditingTeeId("")}
                    onSave={(updatedTee) => { handleUpdateTee(courseRoundId, updatedTee); setEditingTeeId(""); }}
                    onDelete={() => handleDeleteTee(courseRoundId, tee.id)}
                  />
                ))}
                {!getCourseSetup(data.courses, courseRoundId).tees.length && <div className="empty-state">Ingen tee-steder for banen. Legg til tee manuelt eller lim inn baneinformasjon nedenfor.</div>}
              </div>
            </section>

            <section className="content-panel paste-course-panel">
              <div className="content-panel-header"><div><h3>Importer tee-data fra Golfify</h3><p>Hent tee-navn, Par, Course Rating og Slope fra en Golfify-kurside. Du kan kontrollere dataene før lagring.</p></div><Download size={17} color="#f15a24" /></div>
              {adminUnlocked ? <div className="paste-course-content">
                <div className="form-row">
                  <div className="field"><label htmlFor="golfify-course-url">Importer tee-data fra Golfify-URL</label><input id="golfify-course-url" type="url" value={golfifyUrl} onChange={(event) => { setGolfifyUrl(event.target.value); setGolfifyTees([]); }} placeholder="https://www.golfify.io/courses/banenavn" /></div>
                  <button className="secondary-button" type="button" disabled={isLoadingGolfify || !golfifyUrl.trim()} onClick={() => { void handleFetchGolfifyTees(); }}>
                    {isLoadingGolfify ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />}
                    {isLoadingGolfify ? "Henter data …" : "Hent data"}
                  </button>
                </div>
                {golfifyTees.length > 0 && (
                  <div className="parsed-tee-preview">
                    <strong>Fant {golfifyTees.length} tee-steder · kontroller før lagring</strong>
                    <div className="score-table-wrap"><table className="score-table"><thead><tr><th>Tee</th><th>Par</th><th>CR</th><th>Slope</th></tr></thead><tbody>{golfifyTees.map((tee, index) => <tr key={`${tee.name}-${index}`}><td>{tee.name}</td><td>{tee.par}</td><td>{tee.courseRating.toFixed(1)}</td><td>{tee.slopeRating}</td></tr>)}</tbody></table></div>
                    <button className="primary-button" type="button" onClick={() => handleImportParsedTees(golfifyTees)}><Save size={14} /> Lagre tee-oppsett</button>
                  </div>
                )}
              </div> : <div className="admin-locked-note"><Lock size={13} /> Lås opp Admin for å hente inn og lagre tee-data fra Golfify.</div>}
            </section>

            <section className="content-panel paste-course-panel">
              <div className="content-panel-header"><div><h3>Lim inn fra tekst</h3><p>Én tee per linje. Støtter for eksempel «Hvit · Par 72 · CR 73,1 · Slope 132» eller kolonner: Hvit 72 73.1 132.</p></div><ClipboardList size={17} color="#f15a24" /></div>
              {adminUnlocked ? <div className="paste-course-content">
                <textarea className="course-paste-input" value={pasteCourseText} onChange={(event) => { setPasteCourseText(event.target.value); setParsedTees([]); }} placeholder={"Hvit | Par 72 | CR 73,1 | Slope 132\nGul | Par 72 | CR 71,8 | Slope 126"} rows={5} />
                <button className="secondary-button" type="button" onClick={handleParseCourseText}>Les baneinfo</button>
                {parsedTees.length > 0 && (
                  <div className="parsed-tee-preview">
                    <strong>Fant {parsedTees.length} tee-steder</strong>
                    <div className="score-table-wrap"><table className="score-table"><thead><tr><th>Tee</th><th>Par</th><th>CR</th><th>Slope</th></tr></thead><tbody>{parsedTees.map((tee, index) => <tr key={`${tee.name}-${index}`}><td>{tee.name}</td><td>{tee.par}</td><td>{tee.courseRating.toFixed(1)}</td><td>{tee.slopeRating}</td></tr>)}</tbody></table></div>
                    <button className="primary-button" type="button" onClick={() => handleImportParsedTees()}>Importer tee-oppsett</button>
                  </div>
                )}
              </div> : <div className="admin-locked-note"><Lock size={13} /> Lås opp Admin for å importere eller endre tee-oppsettet.</div>}
            </section>
          </section>
        )}
      </main>

      <footer className="page-wrap footer"><span><strong>WINTER TOUR 26/27</strong> · Tournament Club</span><span>Ni runder. Sammenlagt på netto score mot par.</span></footer>
      {toast && <div className="toast" role="status"><Check size={14} />{toast}</div>}
      {lightboxScore?.scorecardImage && (() => {
        const round = tournamentRounds.find((item) => item.id === lightboxScore.roundId);
        const team = data.teams.find((item) => item.id === lightboxScore.entryId);
        const player = data.players.find((item) => item.id === lightboxScore.entryId);
        const entryLabel = team?.name ?? player?.name ?? "Spiller";
        const teamPlayers = team?.playerIds.map((id) => data.players.find((item) => item.id === id)?.name).filter((name): name is string => Boolean(name));
        return <div className="scorecard-lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxScore(null); }}>
          <div className="scorecard-lightbox-content" role="dialog" aria-modal="true" aria-label={`Scorekort for ${entryLabel}`}>
            <div className="scorecard-lightbox-header">
              <div><strong>{entryLabel}{teamPlayers?.length ? ` · ${teamPlayers.join(" & ")}` : ""}</strong><span>Runde {lightboxScore.roundId} · {round?.course ?? "Ukjent bane"} · {lightboxScore.strokes} slag</span></div>
              <button className="scorecard-lightbox-close" type="button" onClick={() => setLightboxScore(null)}><X size={18} /> Lukk</button>
            </div>
            <img src={lightboxScore.scorecardImage} alt={`Scorekort for ${entryLabel}, runde ${lightboxScore.roundId}`} />
            <button className="scorecard-lightbox-close mobile-lightbox-close" type="button" onClick={() => setLightboxScore(null)}><X size={18} /> Lukk</button>
          </div>
        </div>;
      })()}
    </div>
  );
}

function StatCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong className="stat-value">{value}</strong><div className="stat-note">{note}</div></div>;
}

function RoundRow({ round, scores, active, admin, onEdit, onSelect }: { round: Round; scores: Score[]; active: boolean; admin: boolean; onEdit: () => void; onSelect: () => void }) {
  const status = getRoundStatus(round);
  const hasScores = scores.some((score) => score.roundId === round.id);
  const Icon = isTeamFormat(round.format) ? Users : UserRound;
  return (
    <div className="round-row-with-actions">
      <button className={`round-row${active ? " active-row" : ""}`} onClick={onSelect} style={{ width: "100%", textAlign: "left", background: "none", border: 0 }}>
        <span className="round-number">{String(round.id).padStart(2, "0")}</span>
        <span><span className="round-name">{round.course}</span><span className="round-meta"><span>{formatPeriod(round)}</span><span className="format-tag"><Icon size={11} /> {round.format}</span>{hasScores && <span style={{ color: "#f15a24" }}>· Scorekort registrert</span>}</span></span>
        <span className={`status ${status}`}>{getStatusLabel(status)}</span>
        <span className="round-arrow"><ArrowRight size={13} /></span>
      </button>
      {admin && <button className="icon-button" type="button" aria-label={`Rediger runde ${round.id}`} onClick={onEdit}><Pencil size={14} /></button>}
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{description}</p></div></div>;
}

function TeamCard({ team, players, admin, onEdit, onDelete }: { team: Team; players: Player[]; admin: boolean; onEdit: () => void; onDelete: () => void }) {
  const names = team.playerIds.map((id) => players.find((player) => player.id === id)?.name ?? "Spiller");
  return <div className="team-item"><span className="team-icon"><Users size={15} /></span><span className="team-item-main"><span className="team-name">{team.name}</span><span className="team-players">{names.join(" & ")}</span></span>{admin && <div className="entry-actions"><button className="text-action" type="button" onClick={onEdit}><Pencil size={13} /> Rediger</button><button className="text-action danger-text" type="button" onClick={onDelete}><Trash2 size={13} /> Slett</button></div>}</div>;
}

function TeamEditor({ team, players, rounds, teams, onSave, onCancel }: { team: Team; players: Player[]; rounds: Round[]; teams: Team[]; onSave: (team: Team) => boolean; onCancel: () => void }) {
  const [name, setName] = useState(team.name);
  const [roundId, setRoundId] = useState(String(team.roundId));
  const [playerOne, setPlayerOne] = useState(team.playerIds[0]);
  const [playerTwo, setPlayerTwo] = useState(team.playerIds[1]);
  const [error, setError] = useState("");
  const parsedRoundId = Number(roundId);
  const takenPlayerIds = teams.filter((item) => item.id !== team.id && item.roundId === parsedRoundId).flatMap((item) => item.playerIds);

  useEffect(() => {
    setName(team.name);
    setRoundId(String(team.roundId));
    setPlayerOne(team.playerIds[0]);
    setPlayerTwo(team.playerIds[1]);
    setError("");
  }, [team]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = onSave({ ...team, name: name.trim(), roundId: parsedRoundId, playerIds: [playerOne, playerTwo] });
    if (!saved) setError("Kontroller lagnavn, runde og spillerkombinasjon.");
  }

  return (
    <form className="team-edit-form" onSubmit={submit}>
      <div className="field"><label htmlFor={`team-edit-name-${team.id}`}>Lagnavn</label><input id={`team-edit-name-${team.id}`} value={name} onChange={(event) => setName(event.target.value)} required /></div>
      <div className="field"><label htmlFor={`team-edit-round-${team.id}`}>Lagårunde</label><select id={`team-edit-round-${team.id}`} value={roundId} onChange={(event) => setRoundId(event.target.value)}>{rounds.filter((round) => isTeamFormat(round.format)).map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course}</option>)}</select></div>
      <div className="field"><label htmlFor={`team-edit-one-${team.id}`}>Spiller 1</label><select id={`team-edit-one-${team.id}`} value={playerOne} onChange={(event) => setPlayerOne(event.target.value)}>{players.filter((player) => player.id === playerTwo || !takenPlayerIds.includes(player.id)).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
      <div className="field"><label htmlFor={`team-edit-two-${team.id}`}>Spiller 2</label><select id={`team-edit-two-${team.id}`} value={playerTwo} onChange={(event) => setPlayerTwo(event.target.value)}>{players.filter((player) => player.id === playerOne || !takenPlayerIds.includes(player.id)).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
      {error && <span className="form-error">{error}</span>}
      <div className="admin-edit-actions"><button className="secondary-button" type="submit"><Save size={13} /> Lagre lag</button><button className="text-action" type="button" onClick={onCancel}>Avbryt</button></div>
    </form>
  );
}

function RoundEditor({ round, onSave, onCancel }: { round: Round; onSave: (round: Round) => void; onCancel: () => void }) {
  const [course, setCourse] = useState(round.course);
  const [startDate, setStartDate] = useState(round.startDate);
  const [endDate, setEndDate] = useState(round.endDate);
  const [format, setFormat] = useState<RoundFormat>(round.format);
  const [location, setLocation] = useState(round.location);

  useEffect(() => {
    setCourse(round.course);
    setStartDate(round.startDate);
    setEndDate(round.endDate);
    setFormat(round.format);
    setLocation(round.location);
  }, [round]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ ...round, course, startDate, endDate, format, location });
  }

  return <form className="round-edit-form" onSubmit={submit}>
    <div className="field"><label htmlFor={`round-course-${round.id}`}>Banenavn</label><input id={`round-course-${round.id}`} value={course} onChange={(event) => setCourse(event.target.value)} required /></div>
    <div className="field"><label htmlFor={`round-start-${round.id}`}>Fra dato</label><input id={`round-start-${round.id}`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></div>
    <div className="field"><label htmlFor={`round-end-${round.id}`}>Til dato</label><input id={`round-end-${round.id}`} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></div>
    <div className="field"><label htmlFor={`round-format-${round.id}`}>Spilleformat</label><select id={`round-format-${round.id}`} value={format} onChange={(event) => { if (isRoundFormat(event.target.value)) setFormat(event.target.value); }}>{ROUND_FORMATS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    <div className="field"><label htmlFor={`round-location-${round.id}`}>Sted</label><input id={`round-location-${round.id}`} value={location} onChange={(event) => setLocation(event.target.value)} /></div>
    <div className="admin-edit-actions"><button className="secondary-button" type="submit"><Save size={13} /> Lagre runde</button><button className="text-action" type="button" onClick={onCancel}>Avbryt</button></div>
  </form>;
}

function TeeEditor({ tee, admin, editing, onEdit, onCancel, onSave, onDelete }: { tee: Tee; admin: boolean; editing: boolean; onEdit: () => void; onCancel: () => void; onSave: (tee: Tee) => void; onDelete: () => void }) {
  const [name, setName] = useState(tee.name);
  const [par, setPar] = useState(String(tee.par));
  const [courseRating, setCourseRating] = useState(String(tee.courseRating));
  const [slopeRating, setSlopeRating] = useState(String(tee.slopeRating));
  const [error, setError] = useState("");

  useEffect(() => {
    setName(tee.name);
    setPar(String(tee.par));
    setCourseRating(String(tee.courseRating));
    setSlopeRating(String(tee.slopeRating));
    setError("");
  }, [tee]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedPar = Number(par);
    const parsedRating = Number(courseRating.replace(",", "."));
    const parsedSlope = Number(slopeRating);
    if (!name.trim() || !Number.isInteger(parsedPar) || parsedPar < 54 || parsedPar > 90
      || !Number.isFinite(parsedRating) || parsedRating < 50 || parsedRating > 100
      || !Number.isInteger(parsedSlope) || parsedSlope < 55 || parsedSlope > 155) {
      setError("Sjekk tee-navn, Par (54–90), CR (50–100) og Slope (55–155).");
      return;
    }
    setError("");
    onSave({ id: tee.id, name: name.trim(), par: parsedPar, courseRating: Math.round(parsedRating * 10) / 10, slopeRating: parsedSlope });
  }

  if (!editing) {
    return <article className="tee-display">
      <div className="tee-display-values"><strong>{tee.name}</strong><span>Par {tee.par}</span><span>CR {tee.courseRating.toFixed(1)}</span><span>Slope {tee.slopeRating}</span></div>
      {admin && <div className="entry-actions"><button className="text-action" type="button" onClick={onEdit}><Pencil size={13} /> Rediger</button><button className="text-action danger-text" type="button" onClick={onDelete}><Trash2 size={13} /> Slett</button></div>}
    </article>;
  }

  return (
    <form className="tee-editor" onSubmit={submit}>
      <div className="field"><label htmlFor={`tee-name-${tee.id}`}>Tee-navn</label><input id={`tee-name-${tee.id}`} value={name} onChange={(event) => setName(event.target.value)} required /></div>
      <div className="field"><label htmlFor={`tee-par-${tee.id}`}>Par</label><input id={`tee-par-${tee.id}`} type="number" min="54" max="90" value={par} onChange={(event) => setPar(event.target.value)} required /></div>
      <div className="field"><label htmlFor={`tee-cr-${tee.id}`}>Course Rating</label><input id={`tee-cr-${tee.id}`} type="number" min="50" max="100" step="0.1" value={courseRating} onChange={(event) => setCourseRating(event.target.value)} required /></div>
      <div className="field"><label htmlFor={`tee-slope-${tee.id}`}>Slope Rating</label><input id={`tee-slope-${tee.id}`} type="number" min="55" max="155" step="1" value={slopeRating} onChange={(event) => setSlopeRating(event.target.value)} required /></div>
      <div className="tee-editor-actions"><button className="secondary-button" type="submit"><Save size={13} /> Lagre tee</button><button className="text-action" type="button" onClick={onCancel}>Avbryt</button></div>
      {error && <span className="form-error">{error}</span>}
    </form>
  );
}

function ScoreResults({
  results,
  players,
  admin,
  onEdit,
  onDelete,
  onViewImage,
  onImageUpload,
  onDeleteImage,
}: {
  results: ResultRow[];
  players: Player[];
  admin: boolean;
  onEdit?: (score: Score) => void;
  onDelete?: (score: Score) => void;
  onViewImage?: (score: Score) => void;
  onImageUpload?: (scoreId: string, file?: File) => void;
  onDeleteImage?: (score: Score) => void;
}) {
  return <div className="score-table-wrap"><table className="score-table"><thead><tr><th>Plass</th><th>Spiller / lag</th><th>Tee</th><th>Brutto</th><th>Spille-HCP</th><th>Mot par</th>{admin && <th>Handling</th>}</tr></thead><tbody>{results.map((result, index) => (
    <tr key={result.entryId}><td className={`table-rank${index === 0 ? " trophy-rank" : ""}`}>{String(index + 1).padStart(2, "0")}</td><td>{result.label}{result.playerIds.length === 2 && <div style={{ color: "#72777c", fontSize: 9, marginTop: 4 }}>{result.playerIds.map((id) => players.find((player) => player.id === id)?.name ?? "Spiller").join(" & ")}</div>}
      {result.score.scorecardImage && <button className="scorecard-view-button" type="button" onClick={() => onViewImage?.(result.score)}><Camera size={13} /> Se scorekort</button>}
    </td><td className="result-label">{result.teeName}</td><td>{result.strokes}</td><td className="result-label">{formatScore(result.playingHandicap)}</td><td className="score-value">{formatRelativeScore(result.netStrokes)}</td>
      {admin && <td><div className="score-actions">
        <button className="text-action" type="button" onClick={() => onEdit?.(result.score)}><Pencil size={13} /> Rediger</button>
        <label className="text-action score-image-admin-upload"><Upload size={13} /> {result.score.scorecardImage ? "Bytt bilde" : "Legg til bilde"}
          <input className="visually-hidden" type="file" accept="image/*" onChange={(event) => {
            onImageUpload?.(result.score.id, event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }} />
        </label>
        {result.score.scorecardImage && <button className="text-action danger-text" type="button" onClick={() => onDeleteImage?.(result.score)}><Trash2 size={13} /> Slett bilde</button>}
        <button className="text-action danger-text" type="button" onClick={() => onDelete?.(result.score)}><Trash2 size={13} /> Slett resultat</button>
      </div></td>}
    </tr>
  ))}</tbody></table></div>;
}
