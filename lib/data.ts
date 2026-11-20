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
  { roundId: 1, tees: [{ id: "r1-white", name: "Hvit", par: 72, courseRating: 75.1, slopeRating: 143 }, { id: "r1-yellow", name: "Gul", par: 72, courseRating: 72.8, slopeRating: 136 }, { id: "r1-blue", name: "Blå", par: 72, courseRating: 70.5, slopeRating: 129 }, { id: "r1-red", name: "Rød", par: 72, courseRating: 68.2, slopeRating: 120 }] },
  { roundId: 2, tees: [{ id: "r2-white", name: "Hvit", par: 70, courseRating: 73.8, slopeRating: 138 }, { id: "r2-yellow", name: "Gul", par: 70, courseRating: 71.4, slopeRating: 131 }, { id: "r2-blue", name: "Blå", par: 70, courseRating: 69.2, slopeRating: 124 }, { id: "r2-red", name: "Rød", par: 70, courseRating: 67.1, slopeRating: 117 }] },
  { roundId: 3, tees: [{ id: "r3-white", name: "Hvit", par: 71, courseRating: 75.0, slopeRating: 143 }, { id: "r3-yellow", name: "Gul", par: 71, courseRating: 72.9, slopeRating: 137 }, { id: "r3-blue", name: "Blå", par: 71, courseRating: 70.8, slopeRating: 130 }, { id: "r3-red", name: "Rød", par: 71, courseRating: 68.6, slopeRating: 122 }] },
  { roundId: 4, tees: [{ id: "r4-white", name: "Hvit", par: 72, courseRating: 75.2, slopeRating: 145 }, { id: "r4-yellow", name: "Gul", par: 72, courseRating: 72.9, slopeRating: 137 }, { id: "r4-blue", name: "Blå", par: 72, courseRating: 70.6, slopeRating: 130 }, { id: "r4-red", name: "Rød", par: 72, courseRating: 68.4, slopeRating: 122 }] },
  { roundId: 5, tees: [{ id: "r5-white", name: "Hvit", par: 71, courseRating: 75.0, slopeRating: 143 }, { id: "r5-yellow", name: "Gul", par: 71, courseRating: 72.6, slopeRating: 135 }, { id: "r5-blue", name: "Blå", par: 71, courseRating: 70.3, slopeRating: 128 }, { id: "r5-red", name: "Rød", par: 71, courseRating: 68.1, slopeRating: 120 }] },
  { roundId: 6, tees: [{ id: "r6-white", name: "Hvit", par: 72, courseRating: 74.4, slopeRating: 139 }, { id: "r6-yellow", name: "Gul", par: 72, courseRating: 72.1, slopeRating: 132 }, { id: "r6-blue", name: "Blå", par: 72, courseRating: 69.9, slopeRating: 125 }, { id: "r6-red", name: "Rød", par: 72, courseRating: 67.8, slopeRating: 118 }] },
  { roundId: 7, tees: [{ id: "r7-white", name: "Hvit", par: 72, courseRating: 75.3, slopeRating: 146 }, { id: "r7-yellow", name: "Gul", par: 72, courseRating: 73.0, slopeRating: 138 }, { id: "r7-blue", name: "Blå", par: 72, courseRating: 70.7, slopeRating: 130 }, { id: "r7-red", name: "Rød", par: 72, courseRating: 68.5, slopeRating: 122 }] },
  { roundId: 8, tees: [{ id: "r8-white", name: "Hvit", par: 72, courseRating: 75.4, slopeRating: 145 }, { id: "r8-yellow", name: "Gul", par: 72, courseRating: 73.1, slopeRating: 138 }, { id: "r8-blue", name: "Blå", par: 72, courseRating: 70.8, slopeRating: 130 }, { id: "r8-red", name: "Rød", par: 72, courseRating: 68.6, slopeRating: 122 }] },
  { roundId: 9, tees: [{ id: "r9-white", name: "Hvit", par: 72, courseRating: 75.0, slopeRating: 143 }, { id: "r9-yellow", name: "Gul", par: 72, courseRating: 72.8, slopeRating: 136 }, { id: "r9-blue", name: "Blå", par: 72, courseRating: 70.5, slopeRating: 129 }, { id: "r9-red", name: "Rød", par: 72, courseRating: 68.3, slopeRating: 121 }] },
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
