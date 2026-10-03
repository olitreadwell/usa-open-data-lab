import {
  buildBlsSeries,
  parseBlsObservations,
  US_UNEMPLOYMENT_SERIES_ID,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type { BlsObservation, BlsSeries } from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// The Bureau of Labor Statistics public data API. Keyless, public domain,
// published by the agency that runs the Current Population Survey.
export const BLS_SERIES_URL = `https://api.bls.gov/publicAPI/v2/timeseries/data/${US_UNEMPLOYMENT_SERIES_ID}`;

/** Years of monthly figures on the chart: two decades, two API calls. */
export const JOBLESS_WINDOW_YEARS = 20;

/** How many years one BLS request may span. */
export const BLS_MAX_YEARS_PER_REQUEST = 10;

/**
 * The window the chart reads: the twenty years ending with the current year.
 *
 * The window rolls forward with the calendar, so the newest month the agency
 * has published is always on the chart. A pinned end year would leave the
 * page showing a month from the past while the source had moved on.
 *
 * @param now - the day to read the window from, for tests
 * @returns the first and last year to ask the API for
 */
export function joblessWindowYears(now: Date = new Date()): { startYear: number; endYear: number } {
  const endYear = now.getUTCFullYear();
  return { startYear: endYear - JOBLESS_WINDOW_YEARS + 1, endYear };
}

export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when the BLS API is
// slow, rate limited, or unreachable from the build runner.
const JOBLESS_FIXTURE_PATH = path.join(process.cwd(), 'src/fixtures/bls-unemployment-rate.json');

/** One month on the chart. A month the agency could not publish is null. */
export interface JoblessPoint {
  label: string;
  value: number | null;
}

/** The series the story renders, with its headline points. */
export interface JoblessSeries {
  points: JoblessPoint[];
  /** Months between the first and last that the agency did not publish. */
  missingMonthLabels: string[];
  latest: BlsObservation;
  peak: BlsObservation;
  lowest: BlsObservation;
  changeFromPeak: number;
  latestLabel: string;
  peakLabel: string;
  lowestLabel: string;
}

/** Short month label, e.g. "Apr 2020". */
export function monthLabel(observation: Pick<BlsObservation, 'year' | 'periodName'>): string {
  return `${observation.periodName.slice(0, 3)} ${observation.year}`;
}

/**
 * Turns the BLS series into chart points and keeps the headline months.
 *
 * The agency marks a month it could not publish with a dash, and the parser
 * drops it. Every month between the first and the last is still laid out on
 * the chart, with the unpublished ones left empty, so the line breaks where
 * the data stops instead of drawing through it.
 *
 * @param series - the parsed BLS series
 * @returns chart points plus the latest, highest, and lowest months
 */
export function buildJoblessSeries(series: BlsSeries): JoblessSeries {
  const first = series.points[0];
  const latest = series.points[series.points.length - 1];
  if (first === undefined || latest === undefined) {
    throw new UsSourceError('No unemployment observations to chart');
  }

  const published = new Map<string, number>();
  for (const point of series.points) {
    published.set(monthKey(point.year, point.period), point.value);
  }

  const points: JoblessPoint[] = [];
  const missingMonthLabels: string[] = [];
  for (const { year, period, periodName } of eachMonth(first, latest)) {
    const value = published.get(monthKey(year, period));
    if (value === undefined) {
      missingMonthLabels.push(monthLabel({ year, periodName }));
    }
    points.push({
      label: monthLabel({ year, periodName }),
      value: value ?? null,
    });
  }

  return {
    points,
    missingMonthLabels,
    latest: series.latest,
    peak: series.peak,
    lowest: series.lowest,
    changeFromPeak: series.changeFromPeak,
    latestLabel: monthLabel(series.latest),
    peakLabel: monthLabel(series.peak),
    lowestLabel: monthLabel(series.lowest),
  };
}

/** Stable key for one month. */
function monthKey(year: number, period: string): string {
  return `${year}-${period}`;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Walks every month from the first observation to the last, inclusive. */
function* eachMonth(
  first: Pick<BlsObservation, 'year' | 'period'>,
  last: Pick<BlsObservation, 'year' | 'period'>,
): Generator<{ year: number; period: string; periodName: string }> {
  let year = first.year;
  let monthIndex = Number(first.period.slice(1)) - 1;
  const lastMonthIndex = Number(last.period.slice(1)) - 1;

  while (year < last.year || (year === last.year && monthIndex <= lastMonthIndex)) {
    const periodName = MONTH_NAMES[monthIndex] ?? '';
    yield { year, period: `M${String(monthIndex + 1).padStart(2, '0')}`, periodName };
    monthIndex += 1;
    if (monthIndex === 12) {
      monthIndex = 0;
      year += 1;
    }
  }
}

/** Fetches a URL with the long build-time timeout, or throws. */
async function fetchJson(url: string): Promise<unknown> {
  const response = await globalThis.fetch(url, {
    signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return response.json();
}

/**
 * Reads the unemployment series at build time, window by window.
 *
 * Falls back to the committed snapshot when the BLS API is slow, rate
 * limited, or unreachable. The snapshot is trimmed to the same window, so a
 * build that fell back charts the same years as a build that did not. The
 * fallback is logged, not swallowed.
 *
 * @param now - the day to read the window from, for tests
 * @returns the series the jobless-rate story renders
 */
export async function fetchJoblessSeries(now: Date = new Date()): Promise<JoblessSeries> {
  const { startYear, endYear } = joblessWindowYears(now);
  const observations: BlsObservation[] = [];
  try {
    for (
      let windowStart = startYear;
      windowStart <= endYear;
      windowStart += BLS_MAX_YEARS_PER_REQUEST
    ) {
      const windowEnd = Math.min(windowStart + BLS_MAX_YEARS_PER_REQUEST - 1, endYear);
      const payload = await fetchJson(
        `${BLS_SERIES_URL}?startyear=${windowStart}&endyear=${windowEnd}`,
      );
      observations.push(...parseBlsObservations(payload));
    }
    return buildJoblessSeries(buildBlsSeries(observations, US_UNEMPLOYMENT_SERIES_ID));
  } catch (error) {
    console.warn(
      `Falling back to the committed unemployment snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    const snapshot = JSON.parse(readFileSync(JOBLESS_FIXTURE_PATH, 'utf8')) as unknown;
    return buildJoblessSeries(
      buildBlsSeries(
        parseBlsObservations(snapshot).filter(
          (observation) => observation.year >= startYear && observation.year <= endYear,
        ),
        US_UNEMPLOYMENT_SERIES_ID,
      ),
    );
  }
}
