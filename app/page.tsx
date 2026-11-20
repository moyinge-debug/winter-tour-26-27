"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  CircleHelp,
  Flag,
  Medal,
  Plus,
  Trophy,
  Users,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatPeriod, getRoundStatus, isTeamFormat, rounds } from "@/lib/data";
import type { Player, Round, Score, Team, TournamentData, View } from "@/lib/types";

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
];

type ResultRow = { entryId: string; label: string; playerIds: string[]; strokes: number; points: number };

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function scoreEntries(roundId: number, players: Player[], teams: Team[], scores: Score[]): ResultRow[] {
  const round = rounds.find((item) => item.id === roundId);
  if (!round) return [];
  const entries = scores.filter((score) => score.roundId === roundId).map((score) => {
    const team = teams.find((item) => item.id === score.entryId);
    if (isTeamFormat(round.format)) {
      if (!team) return null;
      return { entryId: team.id, label: team.name, playerIds: [...team.playerIds], strokes: score.strokes, points: 0 };
    }
    const player = players.find((item) => item.id === score.entryId);
    if (!player) return null;
    return { entryId: player.id, label: player.name, playerIds: [player.id], strokes: score.strokes, points: 0 };
  }).filter((entry): entry is ResultRow => entry !== null).sort((a, b) => a.strokes - b.strokes);

  let place = 0;
  for (let index = 0; index < entries.length;) {
    let end = index + 1;
    while (end < entries.length && entries[end].strokes === entries[index].strokes) end++;
    const averagePoints = Array.from({ length: end - index }, (_, offset) => POINTS_BY_PLACE[place + offset] ?? 0)
      .reduce((sum, point) => sum + point, 0) / (end - index);
    for (let tied = index; tied < end; tied++) entries[tied].points = averagePoints;
    place += end - index;
    index = end;
  }
  return entries;
}

function getOom(players: Player[], teams: Team[], scores: Score[]) {
  const totals = new Map(players.map((player) => [player.id, 0]));
  for (const round of rounds) {
    for (const result of scoreEntries(round.id, players, teams, scores)) {
      for (const playerId of result.playerIds) {
        totals.set(playerId, (totals.get(playerId) ?? 0) + result.points);
      }
    }
  }
  return players.map((player) => ({ player, points: totals.get(player.id) ?? 0 }))
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
  const [data, setData] = useState<TournamentData>({ players: [], teams: [], scores: [] });
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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isValidData(parsed)) setData(removeDemoData(parsed));
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  const results = useMemo(() => scoreEntries(selectedRoundId, data.players, data.teams, data.scores), [selectedRoundId, data]);
  const leaderboardResults = useMemo(() => scoreEntries(leaderboardRoundId, data.players, data.teams, data.scores), [leaderboardRoundId, data]);
  const oom = useMemo(() => getOom(data.players, data.teams, data.scores), [data]);
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

  function handleAddPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = playerName.trim();
    const parsedHandicap = Number(handicap);
    if (!normalizedName || !Number.isFinite(parsedHandicap) || parsedHandicap < 0 || parsedHandicap > 54) {
      showToast("Skriv inn navn og et handicap mellom 0 og 54.");
      return;
    }
    if (data.players.some((player) => player.name.toLocaleLowerCase("nb") === normalizedName.toLocaleLowerCase("nb"))) {
      showToast("En spiller med dette navnet finnes allerede.");
      return;
    }
    const player = { id: crypto.randomUUID(), name: normalizedName, handicap: parsedHandicap };
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
    const numericScore = Number(strokes);
    if (!entryId || !Number.isInteger(numericScore) || numericScore < 40 || numericScore > 180) {
      showToast("Velg spiller/lag og skriv inn en gyldig score (40–180).");
      return;
    }
    const entryExists = selectedEntries.some((entry) => entry.id === entryId);
    if (!entryExists) {
      showToast("Spilleren eller laget finnes ikke i denne runden.");
      return;
    }
    const score: Score = { id: crypto.randomUUID(), roundId: selectedRoundId, entryId, strokes: numericScore, updatedAt: new Date().toISOString() };
    setData((current) => ({
      ...current,
      scores: [...current.scores.filter((item) => !(item.roundId === selectedRoundId && item.entryId === entryId)), score],
    }));
    setStrokes("");
    showToast("Resultatet er lagret på scorekortet.");
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
                <div className="leader-info"><div className="leader-name">{player.name}</div><div className="leader-sub">HCP {player.handicap.toFixed(1)}</div></div>
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
                  {rounds.map((round) => <RoundRow key={round.id} round={round} scores={data.scores} active={round.id === nextRound.id} onSelect={() => { setSelectedRoundId(round.id); setView("scorecard"); }} />)}
                </div>
              </section>
            </div>
          </>
        )}

        {view === "players" && (
          <section className="content-section">
            <SectionHeading eyebrow="Startfeltet" title="Spillere & lag" description="Legg til spillere og sett sammen par for hver lagrunde." />
            <div className="content-panel">
              <div className="content-panel-header"><div><h3>Legg til spiller</h3><p>Handicap brukes som referanse på spillerkortet.</p></div><span className="season-pill"><Users size={13} /> {data.players.length} spillere</span></div>
              <form className="form-row" onSubmit={handleAddPlayer}>
                <div className="field" style={{ flex: 2 }}><label htmlFor="player-name">Spillernavn</label><input id="player-name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="F.eks. Alex Hansen" /></div>
                <div className="field" style={{ maxWidth: 140 }}><label htmlFor="player-hcp">Handicap</label><input id="player-hcp" type="number" min="0" max="54" step="0.1" value={handicap} onChange={(event) => setHandicap(event.target.value)} placeholder="12.4" /></div>
                <button className="primary-button" type="submit"><Plus size={14} /> Legg til</button>
              </form>
              <div className="player-list">
                {data.players.map((player) => <div className="player-card" key={player.id}><PlayerAvatar name={player.name} dark /><div className="player-card-main"><div className="player-card-name">{player.name}</div><div className="player-card-meta">Winter Tour · spiller</div></div><div className="hcp">{player.handicap.toFixed(1)}<small style={{ display: "block", color: "#72777c", font: "8px Arial", textAlign: "right", marginTop: 3 }}>HCP</small></div></div>)}
              </div>
            </div>

            <div className="content-panel" style={{ marginTop: 15 }}>
              <div className="content-panel-header"><div><h3>Lagoppstilling</h3><p>Opprett 2-mannslag for valgt runde. Hver spiller kan kun være på ett lag per runde.</p></div><span className="team-icon"><Users size={16} /></span></div>
              <form className="team-builder" onSubmit={handleAddTeam}>
                <div className="field"><label htmlFor="team-round">Velg lagrunde</label><select id="team-round" value={selectedRoundId} onChange={(event) => { setSelectedRoundId(Number(event.target.value)); setTeamPlayerOne(""); setTeamPlayerTwo(""); }}><option value="" disabled>Velg runde</option>{rounds.filter((round) => isTeamFormat(round.format)).map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course} ({round.format})</option>)}</select></div>
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
            <SectionHeading eyebrow="Rundens scorekort" title="Registrer resultat" description="Legg inn brutto slag. Laveste score vinner runden." />
            <div className="score-layout">
              <section className="content-panel">
                <div className="content-panel-header"><div><h3>Ny score</h3><p>Resultatene lagres automatisk på denne enheten.</p></div><Medal size={17} color="#f15a24" /></div>
                <form className="score-form" onSubmit={handleSaveScore}>
                  <div className="field"><label htmlFor="score-round">Runde</label><select id="score-round" value={selectedRoundId} onChange={(event) => { setSelectedRoundId(Number(event.target.value)); setEntryId(""); }}><option value="" disabled>Velg runde</option>{rounds.map((round) => <option key={round.id} value={round.id}>Runde {round.id} · {round.course}</option>)}</select></div>
                  <div className="field"><label htmlFor="score-course">Bane & format</label><div className="select-control" id="score-course" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#282b2f" }}><span>{selectedRound.format} · Par {selectedRound.par}</span><span style={{ color: "#f15a24" }}>HCP registreres separat</span></div></div>
                  <div className="field"><label htmlFor="score-player">{isTeamFormat(selectedRound.format) ? "Lag" : "Spiller"}</label><select id="score-player" value={entryId} onChange={(event) => setEntryId(event.target.value)}><option value="">Velg {isTeamFormat(selectedRound.format) ? "lag" : "spiller"}</option>{selectedEntries.map((entry) => <option key={entry.id} value={entry.id}>{isTeamFormat(selectedRound.format) ? (entry as Team).name : (entry as Player).name}</option>)}</select></div>
                  <div className="field"><label htmlFor="score-strokes">Brutto slag</label><input id="score-strokes" type="number" min="40" max="180" step="1" value={strokes} onChange={(event) => setStrokes(event.target.value)} placeholder={`Par ${selectedRound.par} · f.eks. 74`} /></div>
                  {isTeamFormat(selectedRound.format) && selectedRoundTeams.length === 0 && <div className="leader-empty" style={{ padding: "3px 0 13px", textAlign: "left" }}>Ingen lag er satt opp for denne runden. <button className="subtle-link" style={{ display: "inline-flex", padding: 0 }} type="button" onClick={() => setView("players")}>Opprett lag <ArrowRight size={12} /></button></div>}
                  <button className="primary-button" type="submit"><Check size={14} /> Lagre resultat</button>
                </form>
              </section>
              <section className="content-panel">
                <div className="content-panel-header"><div><h3>Runde {selectedRound.id} · {selectedRound.course}</h3><p>{formatPeriod(selectedRound)} · {selectedRound.format} · Par {selectedRound.par}</p></div><span className={`status ${getRoundStatus(selectedRound)}`}>{getStatusLabel(getRoundStatus(selectedRound))}</span></div>
                {results.length ? <ScoreResults results={results} players={data.players} par={selectedRound.par} /> : <div className="empty-state">Scorekortet er tomt ennå.<br />Legg inn første resultat for å se rundens leaderboard.</div>}
              </section>
            </div>
          </section>
        )}

        {view === "leaderboard" && (
          <section className="content-section">
            <SectionHeading eyebrow="Kampen om tittelen" title="Leaderboard" description="Poeng følger plassering. Lagets poengsum tilfaller begge spillerne." />
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
                  <div className="score-table-wrap"><table className="leaderboard-table"><thead><tr><th>Plass</th><th>Spiller</th><th>HCP</th><th>Poeng</th></tr></thead><tbody>
                    {oom.map(({ player, points }, index) => <tr key={player.id}><td className={index === 0 && points > 0 ? "trophy-rank" : "table-rank"}>{String(index + 1).padStart(2, "0")}{index === 0 && points > 0 ? "  ♛" : ""}</td><td><span className="player-inline"><PlayerAvatar name={player.name} dark />{player.name}</span></td><td className="result-label">{player.handicap.toFixed(1)}</td><td className="points-cell">{points}<span className="score-par">POENG</span></td></tr>)}
                  </tbody></table></div>
                  <div className="leaderboard-foot">Poeng per plassering: 1. 12 · 2. 10 · 3. 8 · 4. 6 · 5. 4 · 6. 2. Delte plasseringer deler poengene for plassene. Poeng fra lagrunder føres på begge lagspillere.</div>
                </>
              ) : leaderboardResults.length ? (
                <>
                  <ScoreResults results={leaderboardResults} players={data.players} par={rounds.find((round) => round.id === leaderboardRoundId)?.par ?? 72} />
                  <div className="leaderboard-foot">Rundepoeng deles ut etter plassering og legges til Order of Merit.</div>
                </>
              ) : <div className="empty-state">Ingen resultater registrert for denne runden ennå.</div>}
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

function ScoreResults({ results, players, par }: { results: ResultRow[]; players: Player[]; par: number }) {
  return <div className="score-table-wrap"><table className="score-table"><thead><tr><th>Plass</th><th>Spiller / lag</th><th>Slag</th><th>Poeng</th></tr></thead><tbody>{results.map((result, index) => (
    <tr key={result.entryId}><td className={`table-rank${index === 0 ? " trophy-rank" : ""}`}>{String(index + 1).padStart(2, "0")}</td><td>{result.label}{result.playerIds.length === 2 && <div style={{ color: "#72777c", fontSize: 9, marginTop: 4 }}>{result.playerIds.map((id) => players.find((player) => player.id === id)?.name ?? "Spiller").join(" & ")}</div>}</td><td className="score-value">{result.strokes}<span className="score-par">{result.strokes - par === 0 ? "E" : result.strokes - par > 0 ? `+${result.strokes - par}` : result.strokes - par}</span></td><td className="points-cell">{Number.isInteger(result.points) ? result.points : result.points.toFixed(1)}</td></tr>
  ))}</tbody></table></div>;
}
