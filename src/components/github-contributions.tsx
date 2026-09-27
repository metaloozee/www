import type {
  ContributionGrid,
  ContributionLevel,
} from "@/lib/github-contributions";

// One VGA cell is 8x16 font pixels; each day takes half a cell (8x8)
// and draws a 6x6 square, leaving a 2px gap like the boot progress bar.
const PITCH = 8;
const SQUARE = 6;
const LABEL_ROW = 16;
const LABEL_GAP = 8;

const LEVEL_FILL: Record<ContributionLevel, string> = {
  0: "var(--color-phosphor-ghost)",
  1: "var(--color-phosphor-faint)",
  2: "var(--color-phosphor-dim)",
  3: "var(--color-phosphor)",
  4: "var(--color-phosphor-hot)",
};

const LEVELS: ContributionLevel[] = [0, 1, 2, 3, 4];

interface GitHubContributionsProps {
  grid: ContributionGrid;
  // Position of the profile link in the CRT's link order, so focusing it
  // lights the matching cells on the canvas.
  linkId?: number;
  profileUrl: string;
}

export function GitHubContributions({
  grid,
  linkId,
  profileUrl,
}: GitHubContributionsProps) {
  if (grid.days.length === 0) {
    return (
      <p style={{ color: "var(--color-phosphor-faint)" }}>
        ERROR: contribution data unavailable.
      </p>
    );
  }

  const width = grid.weeks * PITCH - (PITCH - SQUARE);
  const top = LABEL_ROW + LABEL_GAP;
  const height = top + 7 * PITCH - (PITCH - SQUARE);
  const summary = `${grid.total.toLocaleString("en")} contributions in the last year`;

  return (
    <figure
      style={{
        fontFamily: "var(--font-screen)",
        margin: 0,
        maxWidth: "100%",
        overflowX: "auto",
        width: "max-content",
      }}
    >
      <svg
        aria-label={`GitHub contribution graph: ${summary}`}
        height={height}
        role="img"
        style={{ display: "block" }}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        {grid.months.map((month) => (
          <text
            dominantBaseline="hanging"
            fill="var(--color-phosphor-faint)"
            fontSize={LABEL_ROW}
            key={month.week}
            x={month.week * PITCH}
            y={0}
          >
            {month.label}
          </text>
        ))}
        {grid.days.map((day) => (
          <rect
            data-date={day.date}
            data-level={day.level}
            fill={LEVEL_FILL[day.level]}
            height={SQUARE}
            key={day.date}
            width={SQUARE}
            x={day.week * PITCH}
            y={top + day.weekday * PITCH}
          >
            <title>{`${day.date}: ${day.count} contributions`}</title>
          </rect>
        ))}
      </svg>
      <figcaption
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: "0 2ch",
          justifyContent: "space-between",
          paddingTop: LABEL_GAP,
        }}
      >
        <span style={{ color: "var(--color-phosphor-dim)" }}>
          {summary} on{" "}
          <a
            data-link={linkId}
            href={profileUrl}
            rel="noopener"
            style={{ color: "var(--color-phosphor)" }}
            target="_blank"
          >
            GITHUB →<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </span>
        <span
          aria-hidden="true"
          style={{
            alignItems: "center",
            color: "var(--color-phosphor-faint)",
            display: "flex",
            gap: PITCH - SQUARE,
          }}
        >
          <span style={{ paddingRight: "1ch" }}>LESS</span>
          {LEVELS.map((level) => (
            <svg height={SQUARE} key={level} width={SQUARE}>
              <title>{`Level ${level}`}</title>
              <rect fill={LEVEL_FILL[level]} height={SQUARE} width={SQUARE} />
            </svg>
          ))}
          <span style={{ paddingLeft: "1ch" }}>MORE</span>
        </span>
      </figcaption>
    </figure>
  );
}
