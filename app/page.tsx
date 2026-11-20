"use client";

import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ClipboardList,
  CircleHelp,
  Flag,
  LoaderCircle,
  Medal,
  Plus,
  ScanLine,
  Trash2,
  Trophy,
  Users,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultCourses, formatPeriod, getRoundStatus, isTeamFormat, rounds } from "@/lib/data";
import { getCourseSetup, getHandicapHistory, getPlayingHandicap, getTournamentHandicap, getTournamentHandicapSnapshot, getTee } from "@/lib/handicap";
import type { CourseSetup, Player, Round, Score, Team, Tee, TournamentData, View } from "@/lib/types";

const STORAGE_KEY = "winter-tour-26-27";
const DEMO_PLAYER_IDS = new Set(["p1", "p2", "p3", "p4", "p5", "p6"]);
const DEMO_TEAM_IDS = new Set(["t2a", "t2b", "t2c", "t4a", "t4b", "t4c", "t6a", "t6b", "t6c", "t8a", "t8b", "t8c"]);
const DEMO_SCORE_IDS = new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"]);
const POINTS_BY_PLACE = [12, 10, 8, 6, 4, 2];
const NAV_ITEMS: { id: View; label: string; icon: typeof Flag }[] = [
  { id: "overview", label: "Oversikt", icon: Flag },
  { id: "players", label: "Spillere & lag", icon: Users },
  { id: "scorecard", label: "Scorekort", icon: ClipboardList },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "courses", label: "Baner & Tee-oppsett", icon: Flag },
];

type ResultRow = {
  entryId: string;
  label: string;
  playerIds: string[];
  strokes: number;
  playingHandicap: number;
  netStrokes: number;
  points: number;
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
    if (!name || !par || !courseRating || !slopeRating) return [];
    return [{ name, par, courseRating, slopeRating }];
  });
}

function extractScoreFromText(text: string): number | undefined {
  const labeled = [...text.matchAll(/\b(?:gross|score|total|brutto|slag)\s*[:#-]?\s*(\d{2,3})\b/gi)];
  const candidate = labeled.at(-1)?.[1] ?? [...text.matchAll(/\b(\d{2,3})\b/g)].at(-1)?.[1];
  const score = candidate ? Number(candidate) : NaN;
  return Number.isInteger(score) && score >= 40 && score <= 180 ? score : undefined;
}

function getCourseSetups(courses?: CourseSetup[]): CourseSetup[] {
  return defaultCourses.map((defaultCourse) =>
    courses?.find((course) => course.roundId === defaultCourse.roundId) ?? defaultCourse,
  );
}

function scoreEntries(roundId: number, data: TournamentData): ResultRow[] {
  const round = rounds.find((item) => item.id === roundId);
  if (!round) return [];
  const tee = getTee(data.courses, roundId);
  const entries = data.scores.filter((score) => score.roundId === roundId).map((score) => {
    const scoreTee = getTee(data.courses, roundId, score.teeId) ?? tee;
    const team = data.teams.find((item) => item.id === score.entryId);
    if (isTeamFormat(round.format)) {
      if (!team) return null;
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
        netStrokes: Math.round((score.strokes - playingHandicap) * 100) / 100,
        points: 0,
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
      netStrokes: Math.round((score.strokes - playingHandicap) * 100) / 100,
      points: 0,
      teeName: scoreTee?.name ?? "—",
      teePar: scoreTee?.par ?? round.par,
      score,
    };
  }).filter((entry): entry is ResultRow => entry !== null).sort((a, b) => a.netStrokes - b.netStrokes);

  let place = 0;
  for (let index = 0; index < entries.length;) {
    let end = index + 1;
    while (end < entries.length && entries[end].netStrokes === entries[index].netStrokes) end++;
    const averagePoints = Array.from({ length: end - index }, (_, offset) => POINTS_BY_PLACE[place + offset] ?? 0)
      .reduce((sum, point) => sum + point, 0) / (end - index);
    for (let tied = index; tied < end; tied++) entries[tied].points = averagePoints;
    place += end - index;
    index = end;
  }
  return entries;
}

function getOom(data: TournamentData) {
  const totals = new Map(data.players.map((player) => [player.id, 0]));
  for (const round of rounds) {
    for (const result of scoreEntries(round.id, data)) {
      for (const playerId of result.playerIds) {
        totals.set(playerId, (totals.get(playerId) ?? 0) + result.points);
      }
    }
  }
  return data.players.map((player) => ({ player, points: totals.get(player.id) ?? 0 }))
    .sort((a, b) => b.points - a.points || a.player.name.localeCompare(b.player.name, "nb"));
}

function isValidData(value: unknown): value is TournamentData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<TournamentData>;
  return Array.isArray(data.players) && Array.isArray(data.teams) && Array.isArray(data.scores);
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
  const [data, setData] = useState<TournamentData>({ players: [], teams: [], scores: [], courses: defaultCourses });
  const [view, setView] = useState<View>("overview");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState(2);
  const [leaderboardRoundId, setLeaderboardRoundId] = useState(1);
  const [leaderboardMode, setLeaderboardMode] = useState<"oom" | "round">("oom");
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
  const [courseRoundId, setCourseRoundId] = useState(1);
  const [newTeeName, setNewTeeName] = useState("");
  const [pasteCourseText, setPasteCourseText] = useState("");
  const [parsedTees, setParsedTees] = useState<Omit<Tee, "id">[]>([]);
  const scoreImageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isValidData(parsed)) {
          const cleaned = removeDemoData(parsed);
          const savedCourses = cleaned.courses ?? [];
          const courses = defaultCourses.map((defaultCourse) =>
            savedCourses.find((course) => course.roundId === defaultCourse.roundId) ?? defaultCourse,
          );
          setData({ ...cleaned, courses });
        }
      }
    } catch (error) {
      console.error("Could not load tournament data from localStorage.", error);
    } finally {
      setReady(true);
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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedRound = rounds.find((round) => round.id === selectedRoundId) ?? rounds[0];
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
  const livePoints = validLiveScore && selectedTee && entryId
    ? scoreEntries(selectedRoundId, {
      ...data,
      scores: [
        ...data.scores.filter((score) => !(score.roundId === selectedRoundId && score.entryId === entryId)),
        { id: editingScoreId || "preview", roundId: selectedRoundId, entryId, strokes: numericScore, teeId: selectedTee.id, updatedAt: "" },
      ],
    }).find((result) => result.entryId === entryId)?.points
    : undefined;
  const results = useMemo(() => scoreEntries(selectedRoundId, data), [selectedRoundId, data]);
  const leaderboardResults = useMemo(() => scoreEntries(leaderboardRoundId, data), [leaderboardRoundId, data]);
  const oom = useMemo(() => getOom(data), [data]);
  const activeRound = rounds.find((round) => getRoundStatus(round) === "active");
  const nextRound = activeRound ?? rounds.find((round) => getRoundStatus(round) === "upcoming") ?? rounds[0];
  const finishedCount = rounds.filter((round) => getRoundStatus(round) === "completed").length;
  const activeCount = data.scores.length;

  function showToast(message: string) {
    setToast(message);
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
    setEditingScoreId("");
  }

  function handleAddPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    const player = { id: crypto.randomUUID(), name: normalizedName, handicap: Math.round(parsedHandicap * 10) / 10 };
    setData((current) => ({ ...current, players: [...current.players, player] }));
    setPlayerName("");
    setHandicap("");
    showToast(`${normalizedName} er lagt til i startfeltet.`);
  }

  function handleAddTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  function handleSaveScore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    const score: Score = {
      id: editingScoreId || crypto.randomUUID(),
      roundId: selectedRoundId,
      entryId,
      strokes: parsedScore,
      teeId: selectedTee.id,
      updatedAt: new Date().toISOString(),
    };
    setData((current) => ({
      ...current,
      scores: [...current.scores.filter((item) => item.id !== score.id && !(item.roundId === selectedRoundId && item.entryId === entryId)), score],
    }));
    setStrokes("");
    setEditingScoreId("");
    showToast(editingScoreId ? "Resultatet er oppdatert. HCP-historikken er beregnet på nytt." : "Resultatet er lagret på scorekortet.");
  }

  function handleDeleteScore(score: Score) {
    setData((current) => ({ ...current, scores: current.scores.filter((item) => item.id !== score.id) }));
    if (editingScoreId === score.id) {
      setEditingScoreId("");
      setEntryId("");
      setStrokes("");
    }
    showToast("Resultatet er slettet. HCP-historikken er beregnet på nytt.");
  }

  async function handleScanImage(file?: File) {
    if (!file) return;
    setIsScanning(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      try {
        const { data: result } = await worker.recognize(file);
        const text = result.text;
        const scannedScore = extractScoreFromText(text);
        const normalizedText = text.toLocaleLowerCase("nb");
        const scannedTee = selectedCourse.tees.find((tee) => normalizedText.includes(tee.name.toLocaleLowerCase("nb")));
        const matchingPlayer = data.players.find((player) =>
          normalizedText.includes(player.name.toLocaleLowerCase("nb")),
        );
        const matchingTeam = selectedRoundTeams.find((team) =>
          normalizedText.includes(team.name.toLocaleLowerCase("nb")),
        );
        if (scannedScore !== undefined) setStrokes(String(scannedScore));
        if (scannedTee) setSelectedTeeId(scannedTee.id);
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
    const name = newTeeName.trim();
    if (!name) {
      showToast("Skriv inn et navn på tee-stedet.");
      return;
    }
    const setup = getCourseSetup(data.courses, courseRoundId);
    const coursePar = rounds.find((round) => round.id === courseRoundId)?.par ?? 72;
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
    const setup = getCourseSetup(data.courses, roundId);
    if (setup.tees.length <= 1) {
      showToast("En bane må ha minst ett tee-sted.");
      return;
    }
    if (data.scores.some((score) => score.roundId === roundId && score.teeId === teeId)) {
      showToast("Tee-stedet brukes av et scorekort. Rediger verdiene i stedet for å slette det.");
      return;
    }
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
    const parsed = parseTeeText(pasteCourseText);
    setParsedTees(parsed);
    if (!parsed.length) showToast("Fant ingen komplette tee-linjer. Bruk formatet: Hvit · Par 72 · CR 73,1 · Slope 132.");
  }

  function handleImportParsedTees() {
    if (!parsedTees.length) return;
    setData((current) => {
      const courses = getCourseSetups(current.courses).map((course) => {
        if (course.roundId !== courseRoundId) return course;
        const tees = parsedTees.map((tee) => {
          const existing = course.tees.find((item) => item.name.toLocaleLowerCase("nb") === tee.name.toLocaleLowerCase("nb"));
          return { ...tee, id: existing?.id ?? crypto.randomUUID() };
        });
        const importedIds = new Set(tees.map((tee) => tee.id));
        const usedTees = course.tees.filter((tee) =>
          current.scores.some((score) => score.roundId === courseRoundId && score.teeId === tee.id)
          && !importedIds.has(tee.id),
        );
        return { ...course, tees: [...tees, ...usedTees] };
      });
      return { ...current, courses };
    });
    setParsedTees([]);
    setPasteCourseText("");
    showToast(`${parsedTees.length} tee-steder er importert. Kontroller verdiene før bruk.`);
  }

  const playerOptions = data.players.filter((player) => !selectedRoundTeams.some((team) => team.playerIds.includes(player.id)));

  return (
    <div className="app-shell">
      <header className="page-wrap topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">WT</span>
          <div className="brand-name">Winter Tour 26/27</div>
        </div>
        <div className="topbar-right">
          <span className="season-pill"><CalendarDays size={13} /> 9 runder <span style={{ color: "#f15a24" }}>·</span> nov – mar</span>
          <span className="avatar">WT</span>
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
              <button className="text-button" onClick={() => changeView("leaderboard")}>Se leaderboard <ArrowRight size={14} /></button>
            </div>
          </div>
          <div className="hero-round"><span>{activeRound ? "Runden er i gang" : "Neste tee-off"}</span><strong>Runde {nextRound.id} / 9</strong></div>
        </section>

        <nav className="main-nav" aria-label="Hovedmeny">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item${view === id ? " active" : ""}`} onClick={() => changeView(id)}>
              <Icon size={14} strokeWidth={1.7} />{label}
            </button>
          ))}
        </nav>

        {view === "overview" && (
          <section className="panel panel-dark leader-card home-leaderboard">
            <div className="panel-head">
              <div><div className="panel-title">Leaderboard</div><div className="panel-kicker">Sammenlagt · alle runder</div></div>
              <button className="subtle-link" onClick={() => changeView("leaderboard")}>Se alle <ArrowRight size={15} /></button>
            </div>
            {oom.length === 0 || oom.every((entry) => entry.points === 0) ? (
              <div className="leader-empty">Sesongens første poeng venter.<br />Registrer et resultat for å komme i gang.</div>
            ) : oom.slice(0, 5).map(({ player, points }, index) => (
              <div className="leader-row" key={player.id}>
                <span className={`rank-number${index === 0 ? " gold" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
                <PlayerAvatar name={player.name} dark />
                <div className="leader-info"><div className="leader-name">{player.name}</div><div className="leader-sub">Start {player.handicap.toFixed(1)} · Nå {getTournamentHandicap(player, nextRound.id, data).toFixed(1)}</div></div>
                <div className="leader-points">{points}<small>POENG</small></div>
              </div>
            ))}
            <div className="note"><CircleHelp size={12} /> Lagpoeng føres på begge spillere i laget.</div>
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
                  {rounds.map((round) => <RoundRow key={round.id} round={round} scores={data.scores} active={round.id === nextRound.id} onSelect={() => { selectRound(round.id); setView("scorecard"); }} />)}
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
              <form className="form-row" onSubmit={handleAddPlayer}>
                <div className="field" style={{ flex: 2 }}><label htmlFor="player-name">Spillernavn</label><input id="player-name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="F.eks. Alex Hansen" /></div>
                <div className="field" style={{ maxWidth: 140 }}><label htmlFor="player-hcp">Start-HCP</label><input id="player-hcp" type="number" min="0" max="54" step="0.1" value={handicap} onChange={(event) => setHandicap(event.target.value)} placeholder="12.4" /></div>
                <button className="primary-button" type="submit"><Plus size={14} /> Legg til</button>
              </form>
              <div className="player-list">
                {data.players.map((player) => {
                  const currentHandicap = getTournamentHandicap(player, nextRound.id, data);
                  const history = getHandicapHistory(player, data);
                  return (
                    <article className="player-card player-card-expanded" key={player.id}>
                      <PlayerAvatar name={player.name} dark />
                      <div className="player-card-main">
                        <div className="player-card-name">{player.name}</div>
                        <div className="player-card-meta">Start-HCP {player.handicap.toFixed(1)} · Turnerings-HCP {currentHandicap.toFixed(1)}</div>
                        <details className="hcp-history">
                          <summary>HCP-historikk per runde</summary>
                          <div className="hcp-history-list">
                            {history.map((item) => (
                              <span key={item.roundId} className="hcp-history-item">
                                R{item.roundId}: {item.handicap.toFixed(1)}
                                {item.adjustment !== undefined && <small>{item.adjustment > 0 ? "+" : ""}{item.adjustment.toFixed(1)}</small>}
                              </span>
                            ))}
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
              <form className="team-builder" onSubmit={handleAddTeam}>
                <div className="field"><label htmlFor="team-round">Velg lagrunde</label><select id="team-round" value={selectedRoundId} onChange={(event) => { selectRound(Number(event.target.value)); setTeamPlayerOne(""); setTeamPlayerTwo(""); }}><option value="" disabled>Velg runde</option>{rounds.filter((round) => isTeamFormat(round.format)).map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course} ({round.format})</option>)}</select></div>
                <div className="field"><label htmlFor="team-first">Spiller 1</label><select id="team-first" value={teamPlayerOne} onChange={(event) => setTeamPlayerOne(event.target.value)}><option value="">Velg spiller</option>{playerOptions.filter((player) => player.id !== teamPlayerTwo).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
                <div className="field"><label htmlFor="team-second">Spiller 2</label><select id="team-second" value={teamPlayerTwo} onChange={(event) => setTeamPlayerTwo(event.target.value)}><option value="">Velg spiller</option>{playerOptions.filter((player) => player.id !== teamPlayerOne).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
                <button className="primary-button" type="submit"><Plus size={14} /> Opprett lag</button>
              </form>
              {selectedRoundTeams.length ? (
                <div className="team-list">{selectedRoundTeams.map((team) => <TeamCard key={team.id} team={team} players={data.players} />)}</div>
              ) : <div className="empty-state">Ingen lag for {selectedRound.course} ennå. Velg to spillere for å opprette det første laget.</div>}
            </div>
          </section>
        )}

        {view === "scorecard" && (
          <section className="content-section">
            <SectionHeading eyebrow="Rundens scorekort" title="Registrer resultat" description="Legg inn brutto slag. Laveste netto score vinner runden." />
            <div className="score-layout">
              <section className="content-panel">
                <div className="content-panel-header"><div><h3>{editingScoreId ? "Rediger resultat" : "Registrer resultat"}</h3><p>Resultatene lagres automatisk på denne enheten.</p></div><Medal size={17} color="#f15a24" /></div>
                <div className="score-methods" role="tablist" aria-label="Registreringsmetode">
                  <button type="button" className={`segment${scoreMethod === "manual" ? " selected" : ""}`} onClick={() => setScoreMethod("manual")} role="tab" aria-selected={scoreMethod === "manual"}>Manuell registrering</button>
                  <button type="button" className={`segment${scoreMethod === "scan" ? " selected" : ""}`} onClick={() => setScoreMethod("scan")} role="tab" aria-selected={scoreMethod === "scan"}><ScanLine size={13} /> Skann scorekort</button>
                </div>
                <form className="score-form" onSubmit={handleSaveScore}>
                  <div className="field"><label htmlFor="score-round">Runde / bane</label><select id="score-round" value={selectedRoundId} onChange={(event) => selectRound(Number(event.target.value))}><option value="" disabled>Velg runde</option>{rounds.map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course}</option>)}</select></div>
                  <div className="field"><label htmlFor="score-tee">Tee-sted</label><select id="score-tee" value={selectedTee?.id ?? ""} onChange={(event) => setSelectedTeeId(event.target.value)}><option value="">Velg tee</option>{selectedCourse.tees.map((tee) => <option key={tee.id} value={tee.id}>{tee.name} · Par {tee.par} · CR {tee.courseRating.toFixed(1)} · Slope {tee.slopeRating}</option>)}</select></div>
                  <div className="field"><label htmlFor="score-player">{isTeamFormat(selectedRound.format) ? "Lag" : "Spiller"}</label><select id="score-player" value={entryId} onChange={(event) => setEntryId(event.target.value)}><option value="">Velg {isTeamFormat(selectedRound.format) ? "lag" : "spiller"}</option>{selectedEntries.map((entry) => <option key={entry.id} value={entry.id}>{isTeamFormat(selectedRound.format) ? (entry as Team).name : (entry as Player).name}</option>)}</select></div>
                  <div className="field"><label htmlFor="score-strokes">Brutto slag</label><input id="score-strokes" type="number" min="40" max="180" step="1" value={strokes} onChange={(event) => setStrokes(event.target.value)} placeholder={`Par ${selectedRound.par} · f.eks. 74`} /></div>
                  {selectedPlayers.length > 0 && selectedTee && (
                    <div className="score-preview">
                      <div><span>Turnerings-HCP</span><strong>{selectedPlayerHandicaps.map((hcp) => hcp.toFixed(1)).join(" / ")}</strong></div>
                      <div><span>Spillehandicap</span><strong>{selectedPlayingHandicaps.join(" / ")}</strong></div>
                      {liveNetVsPar !== undefined && <>
                        <div><span>Netto mot par</span><strong>{liveNetVsPar > 0 ? "+" : ""}{formatScore(liveNetVsPar)}</strong></div>
                        <div><span>HCP neste runde</span><strong>{liveNextHandicaps.map((hcp) => hcp.toFixed(1)).join(" / ")}</strong></div>
                        <div><span>Turneringspoeng (foreløpig)</span><strong>{livePoints ?? "—"}</strong></div>
                        <p>{liveAdjustments.map((adjustment) => adjustment === undefined ? "—" : `${adjustment > 0 ? "+" : ""}${adjustment.toFixed(1)}`).join(" / ")} justering før neste runde · poeng oppdateres når flere resultater registreres.</p>
                      </>}
                    </div>
                  )}
                  {scoreMethod === "scan" && (
                    <div className="scan-box">
                      <input
                        ref={scoreImageInput}
                        className="visually-hidden"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => {
                          void handleScanImage(event.currentTarget.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                      <button className="scan-button" type="button" disabled={isScanning} onClick={() => scoreImageInput.current?.click()}>
                        {isScanning ? <LoaderCircle className="spin" size={16} /> : <Camera size={16} />}
                        {isScanning ? "Leser scorekort …" : "Skann scorekort / bilde"}
                      </button>
                      <span>Ta bilde med kameraet eller velg et skjermbilde. OCR-forslaget kan kontrolleres før lagring.</span>
                    </div>
                  )}
                  {isTeamFormat(selectedRound.format) && selectedRoundTeams.length === 0 && <div className="leader-empty" style={{ padding: "3px 0 13px", textAlign: "left" }}>Ingen lag er satt opp for denne runden. <button className="subtle-link" style={{ display: "inline-flex", padding: 0 }} type="button" onClick={() => setView("players")}>Opprett lag <ArrowRight size={12} /></button></div>}
                  <button className="primary-button" type="submit"><Check size={14} /> {editingScoreId ? "Oppdater resultat" : "Lagre resultat"}</button>
                  {editingScoreId && <button className="secondary-button cancel-edit" type="button" onClick={() => { setEditingScoreId(""); setEntryId(""); setStrokes(""); }}>Avbryt redigering</button>}
                </form>
              </section>
              <section className="content-panel">
                <div className="content-panel-header"><div><h3>Runde {selectedRound.id} · {selectedRound.course}</h3><p>{formatPeriod(selectedRound)} · {selectedRound.format} · Par {selectedTee?.par ?? selectedRound.par}</p></div><span className={`status ${getRoundStatus(selectedRound)}`}>{getStatusLabel(getRoundStatus(selectedRound))}</span></div>
                {results.length ? <ScoreResults
                  results={results}
                  players={data.players}
                  onEdit={(score) => {
                    selectRound(score.roundId);
                    setEntryId(score.entryId);
                    setStrokes(String(score.strokes));
                    setSelectedTeeId(score.teeId ?? getCourseSetup(data.courses, score.roundId).tees[0]?.id ?? "");
                    setEditingScoreId(score.id);
                  }}
                  onDelete={handleDeleteScore}
                /> : <div className="empty-state">Scorekortet er tomt ennå.<br />Legg inn første resultat for å se rundens leaderboard.</div>}
              </section>
            </div>
          </section>
        )}

        {view === "leaderboard" && (
          <section className="content-section">
            <SectionHeading eyebrow="Kampen om tittelen" title="Leaderboard" description="Plasseringer og poeng beregnes etter netto score. Lagets poengsum tilfaller begge spillerne." />
            <section className="content-panel">
              <div className="leaderboard-controls">
                <div className="segmented" role="tablist" aria-label="Leaderboard-visning">
                  <button className={`segment${leaderboardMode === "oom" ? " selected" : ""}`} onClick={() => setLeaderboardMode("oom")} role="tab" aria-selected={leaderboardMode === "oom"}>Order of Merit</button>
                  <button className={`segment${leaderboardMode === "round" ? " selected" : ""}`} onClick={() => setLeaderboardMode("round")} role="tab" aria-selected={leaderboardMode === "round"}>Runderesultat</button>
                </div>
                {leaderboardMode === "round" && <div className="field" style={{ minWidth: 215, flex: "0 1 270px" }}><label htmlFor="leader-round">Velg runde</label><select id="leader-round" value={leaderboardRoundId} onChange={(event) => setLeaderboardRoundId(Number(event.target.value))}><option value="" disabled>Velg runde</option>{rounds.map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course}</option>)}</select></div>}
              </div>
              {leaderboardMode === "oom" ? (
                <>
                  <div className="score-table-wrap"><table className="leaderboard-table"><thead><tr><th>Plass</th><th>Spiller</th><th>Start-HCP</th><th>Turnerings-HCP</th><th>Poeng</th></tr></thead><tbody>
                    {oom.map(({ player, points }, index) => <tr key={player.id}><td className={index === 0 && points > 0 ? "trophy-rank" : "table-rank"}>{String(index + 1).padStart(2, "0")}{index === 0 && points > 0 ? "  ♛" : ""}</td><td><span className="player-inline"><PlayerAvatar name={player.name} dark />{player.name}</span></td><td className="result-label">{player.handicap.toFixed(1)}</td><td>{getTournamentHandicap(player, nextRound.id, data).toFixed(1)}</td><td className="points-cell">{points}<span className="score-par">POENG</span></td></tr>)}
                  </tbody></table></div>
                  <div className="leaderboard-foot">Netto score = brutto slag − spille-HCP. I lagrunder brukes gjennomsnittet av spillernes HCP. Poeng per plassering: 1. 12 · 2. 10 · 3. 8 · 4. 6 · 5. 4 · 6. 2. Delte plasseringer deler poengene for plassene. Poeng fra lagrunder føres på begge lagspillere.</div>
                </>
              ) : leaderboardResults.length ? (
                <>
                  <ScoreResults results={leaderboardResults} players={data.players} />
                  <div className="leaderboard-foot">Rundepoeng deles ut etter plassering og legges til Order of Merit.</div>
                </>
              ) : <div className="empty-state">Ingen resultater registrert for denne runden ennå.</div>}
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
                <div className="field"><label htmlFor="course-round">Turneringsbane</label><select id="course-round" value={courseRoundId} onChange={(event) => { setCourseRoundId(Number(event.target.value)); setParsedTees([]); }}><option value="" disabled>Velg bane</option>{rounds.map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course}</option>)}</select></div>
                <div className="course-default-note">Veiledende standardverdier · Par {rounds.find((round) => round.id === courseRoundId)?.par ?? 72}</div>
              </div>
              <form className="form-row add-tee-form" onSubmit={handleAddTee}>
                <div className="field"><label htmlFor="new-tee-name">Nytt tee-sted</label><input id="new-tee-name" value={newTeeName} onChange={(event) => setNewTeeName(event.target.value)} placeholder="F.eks. Gull · 5 800 m" /></div>
                <button className="primary-button" type="submit"><Plus size={14} /> Legg til tee</button>
              </form>
              <div className="tee-list">
                {getCourseSetup(data.courses, courseRoundId).tees.map((tee) => (
                  <TeeEditor key={tee.id} tee={tee} onSave={(updatedTee) => handleUpdateTee(courseRoundId, updatedTee)} onDelete={() => handleDeleteTee(courseRoundId, tee.id)} />
                ))}
                {!getCourseSetup(data.courses, courseRoundId).tees.length && <div className="empty-state">Ingen tee-steder for banen. Legg til tee manuelt eller lim inn baneinformasjon nedenfor.</div>}
              </div>
            </section>

            <section className="content-panel paste-course-panel">
              <div className="content-panel-header"><div><h3>Lim inn fra tekst</h3><p>Én tee per linje. Støtter for eksempel «Hvit · Par 72 · CR 73,1 · Slope 132» eller kolonner: Hvit 72 73.1 132.</p></div><ClipboardList size={17} color="#f15a24" /></div>
              <div className="paste-course-content">
                <textarea className="course-paste-input" value={pasteCourseText} onChange={(event) => { setPasteCourseText(event.target.value); setParsedTees([]); }} placeholder={"Hvit | Par 72 | CR 73,1 | Slope 132\nGul | Par 72 | CR 71,8 | Slope 126"} rows={5} />
                <button className="secondary-button" type="button" onClick={handleParseCourseText}>Les baneinfo</button>
                {parsedTees.length > 0 && (
                  <div className="parsed-tee-preview">
                    <strong>Fant {parsedTees.length} tee-steder</strong>
                    <div className="score-table-wrap"><table className="score-table"><thead><tr><th>Tee</th><th>Par</th><th>CR</th><th>Slope</th></tr></thead><tbody>{parsedTees.map((tee, index) => <tr key={`${tee.name}-${index}`}><td>{tee.name}</td><td>{tee.par}</td><td>{tee.courseRating.toFixed(1)}</td><td>{tee.slopeRating}</td></tr>)}</tbody></table></div>
                    <button className="primary-button" type="button" onClick={handleImportParsedTees}>Importer tee-oppsett</button>
                  </div>
                )}
              </div>
            </section>
          </section>
        )}
      </main>

      <footer className="page-wrap footer"><span><strong>WINTER TOUR 26/27</strong> · Tournament Club</span><span>Ni runder. Én Order of Merit.</span></footer>
      {toast && <div className="toast" role="status"><Check size={14} />{toast}</div>}
    </div>
  );
}

function StatCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong className="stat-value">{value}</strong><div className="stat-note">{note}</div></div>;
}

function RoundRow({ round, scores, active, onSelect }: { round: Round; scores: Score[]; active: boolean; onSelect: () => void }) {
  const status = getRoundStatus(round);
  const hasScores = scores.some((score) => score.roundId === round.id);
  const Icon = isTeamFormat(round.format) ? Users : UserRound;
  return (
    <button className={`round-row${active ? " active-row" : ""}`} onClick={onSelect} style={{ width: "100%", textAlign: "left", background: "none", border: 0 }}>
      <span className="round-number">{String(round.id).padStart(2, "0")}</span>
      <span><span className="round-name">{round.course}</span><span className="round-meta"><span>{formatPeriod(round)}</span><span className="format-tag"><Icon size={11} /> {round.format}</span>{hasScores && <span style={{ color: "#f15a24" }}>· Scorekort registrert</span>}</span></span>
      <span className={`status ${status}`}>{getStatusLabel(status)}</span>
      <span className="round-arrow"><ArrowRight size={13} /></span>
    </button>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{description}</p></div></div>;
}

function TeamCard({ team, players }: { team: Team; players: Player[] }) {
  const names = team.playerIds.map((id) => players.find((player) => player.id === id)?.name ?? "Spiller");
  return <div className="team-item"><span className="team-icon"><Users size={15} /></span><span><span className="team-name">{team.name}</span><span className="team-players">{names.join(" & ")}</span></span></div>;
}

function TeeEditor({ tee, onSave, onDelete }: { tee: Tee; onSave: (tee: Tee) => void; onDelete: () => void }) {
  const [name, setName] = useState(tee.name);
  const [par, setPar] = useState(String(tee.par));
  const [courseRating, setCourseRating] = useState(String(tee.courseRating));
  const [slopeRating, setSlopeRating] = useState(String(tee.slopeRating));
  const [error, setError] = useState("");

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

  return (
    <form className="tee-editor" onSubmit={submit}>
      <div className="field"><label htmlFor={`tee-name-${tee.id}`}>Tee-navn</label><input id={`tee-name-${tee.id}`} value={name} onChange={(event) => setName(event.target.value)} required /></div>
      <div className="field"><label htmlFor={`tee-par-${tee.id}`}>Par</label><input id={`tee-par-${tee.id}`} type="number" min="54" max="90" value={par} onChange={(event) => setPar(event.target.value)} required /></div>
      <div className="field"><label htmlFor={`tee-cr-${tee.id}`}>Course Rating</label><input id={`tee-cr-${tee.id}`} type="number" min="50" max="100" step="0.1" value={courseRating} onChange={(event) => setCourseRating(event.target.value)} required /></div>
      <div className="field"><label htmlFor={`tee-slope-${tee.id}`}>Slope Rating</label><input id={`tee-slope-${tee.id}`} type="number" min="55" max="155" step="1" value={slopeRating} onChange={(event) => setSlopeRating(event.target.value)} required /></div>
      <div className="tee-editor-actions"><button className="secondary-button" type="submit">Lagre tee</button><button className="icon-button danger" type="button" aria-label={`Slett ${tee.name}`} onClick={onDelete}><Trash2 size={15} /></button></div>
      {error && <span className="form-error">{error}</span>}
    </form>
  );
}

function ScoreResults({
  results,
  players,
  onEdit,
  onDelete,
}: {
  results: ResultRow[];
  players: Player[];
  onEdit?: (score: Score) => void;
  onDelete?: (score: Score) => void;
}) {
  return <div className="score-table-wrap"><table className="score-table"><thead><tr><th>Plass</th><th>Spiller / lag</th><th>Tee</th><th>Brutto</th><th>Spille-HCP</th><th>Netto</th><th>Poeng</th>{(onEdit || onDelete) && <th>Handling</th>}</tr></thead><tbody>{results.map((result, index) => (
    <tr key={result.entryId}><td className={`table-rank${index === 0 ? " trophy-rank" : ""}`}>{String(index + 1).padStart(2, "0")}</td><td>{result.label}{result.playerIds.length === 2 && <div style={{ color: "#72777c", fontSize: 9, marginTop: 4 }}>{result.playerIds.map((id) => players.find((player) => player.id === id)?.name ?? "Spiller").join(" & ")}</div>}</td><td className="result-label">{result.teeName}</td><td>{result.strokes}</td><td className="result-label">{formatScore(result.playingHandicap)}</td><td className="score-value">{formatScore(result.netStrokes)}<span className="score-par">{result.netStrokes - result.teePar === 0 ? "E" : result.netStrokes - result.teePar > 0 ? `+${formatScore(result.netStrokes - result.teePar)}` : formatScore(result.netStrokes - result.teePar)}</span></td><td className="points-cell">{Number.isInteger(result.points) ? result.points : result.points.toFixed(1)}</td>
      {(onEdit || onDelete) && <td><div className="score-actions"><button className="text-action" type="button" onClick={() => onEdit?.(result.score)}>Rediger</button><button className="text-action danger-text" type="button" onClick={() => onDelete?.(result.score)}>Slett</button></div></td>}
    </tr>
  ))}</tbody></table></div>;
}
