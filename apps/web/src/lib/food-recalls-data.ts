import {
  buildOpenFdaFoodRecallSummary,
  fetchOpenFdaFoodRecalls,
  parseOpenFdaFoodRecallSnapshot,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type {
  OpenFdaFoodRecallSummary,
  OpenFdaFoodRecallYear,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** How long a live request may take before the build falls back to the snapshot. */
export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when the openFDA host is
// slow or unreachable from the build runner.
const FOOD_RECALL_FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/openfda-food-recalls-2026-09-30.json',
);

/** One bar on the chart: a calendar year, split by severity. */
export interface FoodRecallBar {
  year: number;
  /** Axis label, e.g. "2020". */
  label: string;
  /** Class I recalls: a reasonable chance of serious harm or death. */
  classOne: number;
  /** Every other classification, including Class II and Class III. */
  other: number;
  /** Every recall published against that year. */
  total: number;
}

/** One classification's share of the file, for the copy that names them. */
export interface FoodRecallClassShare {
  name: string;
  count: number;
  /** Share of the whole file, in percent. */
  sharePercent: number;
}

/** The story's numbers, all read from the enforcement file at deploy time. */
export interface FoodRecallStory {
  bars: FoodRecallBar[];
  recallCount: number;
  classOneCount: number;
  /** Class I as a share of the file, in percent. */
  classOneSharePercent: number;
  /** Every classification in the file, most recalls first. */
  classCounts: FoodRecallClassShare[];
  /** Oldest publication date in the file, e.g. "20 June 2012". */
  firstReportDateLabel: string;
  newestReportDateLabel: string;
  firstYear: number;
  /** Newest year in the file, which is still open. */
  newestYear: number;
  /** Recalls published against the newest year so far. */
  newestYearCount: number;
  /** Recalls published against the first year, which starts mid-year. */
  firstYearCount: number;
  busiestYear: OpenFdaFoodRecallYear;
  voluntaryCount: number;
  /** Firm-initiated recalls as a share of the file, in percent. */
  voluntarySharePercent: number;
  mandatedCount: number;
}

/** Month names, spelled out so a label cannot change with the build runner. */
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

/**
 * Turns an ISO publication date into the label the copy reads.
 *
 * @param isoDate - a date from the endpoint, e.g. "2012-06-20"
 * @returns the same date as "20 June 2012"
 */
export function foodRecallDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const monthName = MONTH_NAMES[Number(month) - 1];
  if (year === undefined || day === undefined || monthName === undefined) {
    throw new UsSourceError(`Unreadable publication date: ${isoDate}`);
  }
  return `${String(Number(day))} ${monthName} ${year}`;
}

/**
 * Splits every year in the file into Class I recalls and the rest.
 *
 * The newest year is a partial year, so its bar fills as the agency publishes
 * more enforcement reports. The caller reads `newestYearCount` when it needs
 * that count on its own.
 *
 * @param years - the per-year counts from the summary
 * @returns one bar per year, oldest first
 */
export function buildFoodRecallBars(years: OpenFdaFoodRecallYear[]): FoodRecallBar[] {
  if (years.length === 0) {
    throw new UsSourceError('No years to chart');
  }
  return years.map((year) => ({
    year: year.year,
    label: String(year.year),
    classOne: year.classOne,
    other: year.other,
    total: year.total,
  }));
}

/**
 * Turns the enforcement file into the bars and figures the story renders.
 *
 * @param summary - the counted enforcement file
 * @returns the chart bars plus the figures the copy quotes
 */
export function buildFoodRecallStory(summary: OpenFdaFoodRecallSummary): FoodRecallStory {
  const first = summary.years[0];
  if (first === undefined) {
    throw new UsSourceError('No years to summarise');
  }

  return {
    bars: buildFoodRecallBars(summary.years),
    recallCount: summary.recallCount,
    classOneCount: summary.classOneCount,
    classOneSharePercent: summary.classOneSharePercent,
    classCounts: summary.classifications.map((entry) => ({
      name: entry.name,
      count: entry.count,
      sharePercent: (entry.count / summary.recallCount) * 100,
    })),
    firstReportDateLabel: foodRecallDateLabel(summary.firstReportDate),
    newestReportDateLabel: foodRecallDateLabel(summary.newestReportDate),
    firstYear: summary.firstYear,
    newestYear: summary.newestYear,
    newestYearCount: summary.newestYearCount,
    firstYearCount: first.total,
    busiestYear: summary.busiestYear,
    voluntaryCount: summary.voluntaryCount,
    voluntarySharePercent: (summary.voluntaryCount / summary.recallCount) * 100,
    mandatedCount: summary.mandatedCount,
  };
}

/**
 * Reads the food enforcement file at build time.
 *
 * Falls back to the committed snapshot when the endpoint is slow or
 * unreachable. The fallback is logged, not swallowed.
 *
 * @returns the chart bars and the figures the story renders
 */
export async function fetchFoodRecallStory(): Promise<FoodRecallStory> {
  const timeoutFetch: typeof globalThis.fetch = (input, init) =>
    globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS) });
  try {
    return buildFoodRecallStory(await fetchOpenFdaFoodRecalls({ fetchImpl: timeoutFetch }));
  } catch (error) {
    console.warn(
      `Falling back to the committed openFDA food recall snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    const snapshot = JSON.parse(readFileSync(FOOD_RECALL_FIXTURE_PATH, 'utf8')) as unknown;
    return buildFoodRecallStory(
      buildOpenFdaFoodRecallSummary(parseOpenFdaFoodRecallSnapshot(snapshot)),
    );
  }
}
