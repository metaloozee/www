export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export interface Activity {
  count: number;
  date: string;
  level: ContributionLevel;
}

export type ContributionDay = Activity & {
  week: number;
  weekday: number;
};

export interface ContributionGrid {
  busiest: Activity | null;
  days: ContributionDay[];
  months: { week: number; label: string }[];
  total: number;
  weeks: number;
}

const API_URL = "https://github-contributions-api.jogruber.de/v4";
const ONE_DAY_SECONDS = 86_400;
const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;
const MIN_WEEKS_FOR_MONTH_LABEL = 3;
const DAY_MS = 86_400_000;

interface ApiResponse {
  contributions?: Activity[];
}

export async function getContributions(username: string): Promise<Activity[]> {
  const res = await fetch(`${API_URL}/${username}?y=last`, {
    next: { revalidate: ONE_DAY_SECONDS },
  });
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as ApiResponse;
  return data.contributions ?? [];
}

const parseDate = (date: string) => new Date(`${date}T00:00:00Z`);

// Lays days out Sunday-first, one column per week, the way GitHub does.
// The CRT canvas draws each day as a half character cell; the DOM
// fallback draws the same coordinates as SVG.
export function toContributionGrid(activities: Activity[]): ContributionGrid {
  const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));
  const [first] = sorted;
  if (!first) {
    return { busiest: null, days: [], months: [], total: 0, weeks: 0 };
  }

  const start = parseDate(first.date);
  const offset = start.getUTCDay();
  const days = sorted.map((activity) => {
    const index =
      Math.round(
        (parseDate(activity.date).getTime() - start.getTime()) / DAY_MS
      ) + offset;
    return {
      ...activity,
      week: Math.floor(index / 7),
      weekday: index % 7,
    };
  });
  const weeks = (days.at(-1)?.week ?? 0) + 1;

  const months: ContributionGrid["months"] = [];
  for (const day of days) {
    if (day.weekday !== 0 && day !== days[0]) {
      continue;
    }
    const label = MONTH_LABELS[parseDate(day.date).getUTCMonth()];
    if (months.at(-1)?.label !== label) {
      months.push({ label, week: day.week });
    }
  }
  const spacedMonths = months.filter((month, i) => {
    const nextWeek = months[i + 1]?.week ?? weeks;
    return nextWeek - month.week >= MIN_WEEKS_FOR_MONTH_LABEL;
  });

  let busiest: Activity | null = null;
  let total = 0;
  for (const day of sorted) {
    total += day.count;
    if (!busiest || day.count > busiest.count) {
      busiest = day;
    }
  }

  return { busiest, days, months: spacedMonths, total, weeks };
}

export function contributionsToMarkdown(
  grid: ContributionGrid,
  profileUrl: string
): string {
  const lines = [
    `- ${grid.total.toLocaleString("en")} GitHub contributions in the last year ([profile](${profileUrl}))`,
  ];
  if (grid.busiest && grid.busiest.count > 0) {
    lines.push(
      `- Busiest day: ${grid.busiest.date} (${grid.busiest.count} contributions)`
    );
  }
  return lines.join("\n");
}
