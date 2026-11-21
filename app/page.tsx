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
