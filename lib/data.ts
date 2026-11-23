import type { CourseSetup, Player, Round } from "./types";

export const initialPlayers: Player[] = [
  { id: "winter-tour-atle", name: "Atle", handicap: 13.8, attendance: "Ja" },
  { id: "winter-tour-henrik-p", name: "Henrik P", handicap: 7.3, attendance: "Ja" },
  { id: "winter-tour-inge", name: "Inge", handicap: 5.7, attendance: "Ja" },
  { id: "winter-tour-jon-sverre", name: "Jon Sverre", handicap: 16.8, attendance: "Ja" },
  { id: "winter-tour-kjetil", name: "Kjetil", handicap: 22.3, attendance: "Nei" },
  { id: "winter-tour-kristian", name: "Kristian", handicap: 10.9, attendance: "Ja" },
  { id: "winter-tour-lars", name: "Lars", handicap: 21.7, attendance: "Ja" },
  { id: "winter-tour-mads-o", name: "Mads O", handicap: 25.9, attendance: "Ja" },
  { id: "winter-tour-mathias", name: "Mathias", handicap: 10.6, attendance: "Ja" },
  { id: "winter-tour-morgan", name: "Morgan", handicap: 15.6, attendance: "Ja" },
  { id: "winter-tour-morten", name: "Morten", handicap: 20.5, attendance: "Ja" },
  { id: "winter-tour-nikko", name: "Nikko", handicap: 12.6, attendance: "Ja" },
  { id: "winter-tour-peder", name: "Peder", handicap: 21.3, attendance: "Kanskje" },
  { id: "winter-tour-orjan", name: "Ørjan", handicap: 20.0, attendance: "Ja" },
];

export const rounds: Round[] = [
  { id: 1, course: "Black Desert", format: "Single", startDate: "2026-11-22", endDate: "2026-12-05", location: "Ivins, Utah", par: 72 },
  { id: 2, course: "Cran-sur-Sierre", format: "Greensome", startDate: "2026-12-06", endDate: "2026-12-19", location: "Crans-Montana, Sveits", par: 70 },
  { id: 3, course: "Real Valderrama", format: "Single", startDate: "2026-12-20", endDate: "2027-01-02", location: "Sotogrande, Spania", par: 71 },
  { id: 4, course: "Lofoten Links", format: "Scramble", startDate: "2027-01-03", endDate: "2027-01-16", location: "Gimsøysand, Norge", par: 72 },
  { id: 5, course: "Trump Turnberry", format: "Single", startDate: "2027-01-17", endDate: "2027-01-30", location: "Ayrshire, Skottland", par: 71 },
  { id: 6, course: "Fairmont Chateau Whistler", format: "Best ball", startDate: "2027-01-31", endDate: "2027-02-13", location: "Whistler, Canada", par: 72 },
  { id: 7, course: "Bandon Dunes", format: "Single", startDate: "2027-02-14", endDate: "2027-02-27", location: "Bandon, Oregon", par: 72 },
  { id: 8, course: "The Reserve at Moonlight Basin", format: "Foursome", startDate: "2027-02-28", endDate: "2027-03-13", location: "Big Sky, Montana", par: 72 },
  { id: 9, course: "Casa De Campo 'Teeth of the Dog'", format: "Single", startDate: "2027-03-14", endDate: "2027-03-27", location: "La Romana, Den dominikanske republikk", par: 72 },
];

export const defaultCourses: CourseSetup[] = [
  { roundId: 1, tees: [] },
  { roundId: 2, tees: [] },
  { roundId: 3, tees: [] },
  { roundId: 4, tees: [] },
  { roundId: 5, tees: [] },
  { roundId: 6, tees: [] },
  { roundId: 7, tees: [] },
  { roundId: 8, tees: [] },
  { roundId: 9, tees: [] },
];

export const isTeamFormat = (format: Round["format"]) => format !== "Single";

export function getRoundStatus(round: Round, today = new Date()): "upcoming" | "active" | "completed" {
  const date = today.toISOString().slice(0, 10);
  if (date < round.startDate) return "upcoming";
  if (date > round.endDate) return "completed";
  return "active";
}

export function formatPeriod(round: Round): string {
  const start = new Date(`${round.startDate}T12:00:00`);
  const end = new Date(`${round.endDate}T12:00:00`);
  const startDay = start.getDate();
  const endDay = end.getDate();
  const month = new Intl.DateTimeFormat("nb-NO", { month: "short" }).format(end).replace(".", "");
  const startMonth = new Intl.DateTimeFormat("nb-NO", { month: "short" }).format(start).replace(".", "");
  if (start.getMonth() === end.getMonth()) return `${startDay}. – ${endDay}. ${month}`;
  return `${startDay}. ${startMonth} – ${endDay}. ${month}`;
}
