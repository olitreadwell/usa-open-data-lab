import {
  buildTreasuryAvgInterestRateSeries,
  buildTreasuryAvgInterestRateUrl,
  parseTreasuryAvgInterestRatePayload,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type {
  TreasuryInterestRateMonth,
  TreasuryInterestRateSeries,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Month abbreviations, indexed from January.
 *
 * Spelled out here rather than read from the runtime's locale, so a label
 * cannot change with the build runner's settings.
 */
const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Rate a month has to sit below to count as cheap money, in percent. */
export const BELOW_RATE_PERCENT = 2;

/** Months in one decade, for the two ten-year averages the story quotes. */
export const MONTHS_PER_DECADE = 120;

export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when the Treasury host
// is slow or unreachable from the build runner.
const TREASURY_RATE_FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/treasury-avg-interest-rate-2026-09-28.json',
);

/** One month on the line chart. */
export interface TreasuryRatePoint {
  /** Month label, e.g. "Aug 2026". */
  label: string;
  /** Average interest rate on the debt that month, in percent. */
  ratePercent: number;
}

/** The story's numbers, all read from the Treasury's file at deploy time. */
export interface TreasuryRateStory {
  /** Every month in the run, oldest first. */
  points: TreasuryRatePoint[];
  monthCount: number;
  first: TreasuryRatePoint;
  latest: TreasuryRatePoint;
  highest: TreasuryRatePoint;
  lowest: TreasuryRatePoint;
  /** The newest month minus the lowest month, in percentage points. */
  changeSinceLow: number;
  /**
   * The most recent earlier month at or above the newest month's rate.
   *
   * This is what lets the copy say "the highest since" without reaching for
   * a second source. Null when the newest month is the highest in the run.
   */
  highestSince: TreasuryRatePoint | null;
  /** Months below two percent, and the first and last of them. */
  belowRateCount: number;
  belowRateFirst: TreasuryRatePoint | null;
  belowRateLast: TreasuryRatePoint | null;
  /** Mean rate over the first ten years of the run and over the last ten. */
  firstDecadeMean: number;
  recentDecadeMean: number;
}

/** Short month label, e.g. "Aug 2026". */
export function treasuryMonthLabel(
  month: Pick<TreasuryInterestRateMonth, 'year' | 'month'>,
): string {
  const abbreviation = MONTH_ABBREVIATIONS[month.month - 1];
  if (abbreviation === undefined) {
    throw new UsSourceError(`No month named ${String(month.month)}`);
  }
  return `${abbreviation} ${String(month.year)}`;
}

/** The average of a run of points, in percent. */
function meanRate(points: TreasuryRatePoint[]): number {
  if (points.length === 0) {
    throw new UsSourceError('No months to average');
  }
  return points.reduce((total, point) => total + point.ratePercent, 0) / points.length;
}

/**
 * Turns the published rate file into the points and figures the page renders.
 *
 * @param series - the parsed monthly average interest rate series
 * @returns the chart points and the months the copy leans on
 */
export function buildTreasuryRateStory(series: TreasuryInterestRateSeries): TreasuryRateStory {
  const points: TreasuryRatePoint[] = series.months.map((month) => ({
    label: treasuryMonthLabel(month),
    ratePercent: month.averageInterestRatePercent,
  }));

  const first = points[0];
  const latest = points[points.length - 1];
  if (first === undefined || latest === undefined) {
    throw new UsSourceError('No months in the average interest rate file');
  }

  const pointAt = (month: TreasuryInterestRateMonth): TreasuryRatePoint => {
    const point = points.find((candidate) => candidate.label === treasuryMonthLabel(month));
    if (point === undefined) {
      throw new UsSourceError(`The rate file is missing ${treasuryMonthLabel(month)}`);
    }
    return point;
  };

  const earlierMonths = points
    .slice(0, -1)
    .filter((point) => point.ratePercent >= latest.ratePercent);
  const belowRate = points.filter((point) => point.ratePercent < BELOW_RATE_PERCENT);

  return {
    points,
    monthCount: series.monthCount,
    first,
    latest,
    highest: pointAt(series.highest),
    lowest: pointAt(series.lowest),
    changeSinceLow: series.changeSinceLowPercentPoints,
    highestSince: earlierMonths[earlierMonths.length - 1] ?? null,
    belowRateCount: belowRate.length,
    belowRateFirst: belowRate[0] ?? null,
    belowRateLast: belowRate[belowRate.length - 1] ?? null,
    firstDecadeMean: meanRate(points.slice(0, MONTHS_PER_DECADE)),
    recentDecadeMean: meanRate(points.slice(-MONTHS_PER_DECADE)),
  };
}

/** The request URL for the whole published run, oldest month first. */
export function treasuryRateUrl(): string {
  return buildTreasuryAvgInterestRateUrl();
}

/**
 * Reads the average interest rate file at build time.
 *
 * Falls back to the committed snapshot when the download is slow or
 * unreachable. The fallback is logged, not swallowed.
 *
 * @returns the chart points and the figures the story renders
 */
export async function fetchTreasuryRateStory(): Promise<TreasuryRateStory> {
  const url = treasuryRateUrl();
  try {
    const response = await globalThis.fetch(url, {
      signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return buildTreasuryRateStory(
      buildTreasuryAvgInterestRateSeries(
        parseTreasuryAvgInterestRatePayload(await response.json()),
      ),
    );
  } catch (error) {
    console.warn(
      `Falling back to the committed Treasury rate snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    return buildTreasuryRateStory(
      buildTreasuryAvgInterestRateSeries(
        parseTreasuryAvgInterestRatePayload(
          JSON.parse(readFileSync(TREASURY_RATE_FIXTURE_PATH, 'utf8')) as unknown,
        ),
      ),
    );
  }
}
