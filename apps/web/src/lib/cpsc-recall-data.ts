import {
  fetchCpscProductRecalls,
  parseCpscRecallSnapshot,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type {
  CpscProductRecallSeries,
  CpscRecallYearCount,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** How long a live request may take before the build falls back to the snapshot. */
export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when the SaferProducts
// host is slow or unreachable from the build runner.
const CPSC_RECALL_FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/cpsc-product-recalls-2026-10-02.json',
);

/** One bar on the chart: a calendar year of recalls. */
export interface CpscRecallBar {
  year: number;
  /** Axis label, e.g. "2025". */
  label: string;
  /** Recalls the agency published that year. */
  recallCount: number;
  /** True for the newest year, which the agency is still filling. */
  partial: boolean;
}

/** One remedy option and its share of the file, for the copy that names them. */
export interface CpscRemedyShare {
  option: string;
  recallCount: number;
  /** Share of the recalls in the window, in percent. */
  sharePercent: number;
}

/** The story's numbers, all read from the recall file at deploy time. */
export interface CpscProductRecallStory {
  bars: CpscRecallBar[];
  totalRecalls: number;
  firstYear: number;
  /** Newest year in the file, which is still open. */
  newestYear: number;
  /** Recalls published against the newest year so far. */
  newestYearCount: number;
  /** Newest recall date written out, e.g. "24 September 2026". */
  newestRecallDateLabel: string;
  /** Busiest of the complete years. */
  busiestCompleteYear: CpscRecallYearCount;
  /** Quietest of the complete years. */
  quietestCompleteYear: CpscRecallYearCount;
  /** Every remedy option in the file, most recalls first. */
  remedies: CpscRemedyShare[];
  refundCount: number;
  repairCount: number;
  /** China's count, the country named on the most recalls. */
  topCountryCount: number;
  /** China's share of the recalls in the window, in percent. */
  topCountrySharePercent: number;
  /** Countries that appear on at least one recall in the window. */
  countryCount: number;
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
 * Turns an ISO recall date into the label the copy reads.
 *
 * @param isoDate - a date from the service, e.g. "2026-09-24"
 * @returns the same date as "24 September 2026"
 */
export function cpscRecallDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const monthName = MONTH_NAMES[Number(month) - 1];
  if (year === undefined || day === undefined || monthName === undefined) {
    throw new UsSourceError(`Unreadable recall date: ${isoDate}`);
  }
  return `${String(Number(day))} ${monthName} ${year}`;
}

/**
 * Turns every year in the window into a bar, marking the newest one partial.
 *
 * @param series - the counted recall file
 * @returns one bar per year, oldest first
 */
export function buildCpscRecallBars(series: CpscProductRecallSeries): CpscRecallBar[] {
  if (series.years.length === 0) {
    throw new UsSourceError('No years to chart');
  }
  return series.years.map((year) => ({
    year: year.year,
    label: String(year.year),
    recallCount: year.recallCount,
    partial: year.year === series.newestYear,
  }));
}

/**
 * Turns the recall file into the bars and figures the story renders.
 *
 * @param series - the counted recall file
 * @returns the chart bars plus the figures the copy quotes
 */
export function buildCpscProductRecallStory(
  series: CpscProductRecallSeries,
): CpscProductRecallStory {
  const topCountry = series.manufacturerCountries[0];
  const newestYearRow = series.years[series.years.length - 1];
  if (topCountry === undefined || newestYearRow === undefined) {
    throw new UsSourceError('The recall file has no newest year or country to summarise');
  }

  return {
    bars: buildCpscRecallBars(series),
    totalRecalls: series.totalRecalls,
    firstYear: series.firstYear,
    newestYear: series.newestYear,
    newestYearCount: newestYearRow.recallCount,
    newestRecallDateLabel: cpscRecallDateLabel(series.newestRecallDate),
    busiestCompleteYear: series.busiestCompleteYear,
    quietestCompleteYear: series.quietestCompleteYear,
    remedies: series.remedyOptions.map((entry) => ({
      option: entry.option,
      recallCount: entry.recallCount,
      sharePercent: (entry.recallCount / series.totalRecalls) * 100,
    })),
    refundCount: series.remedyOptions.find((entry) => entry.option === 'Refund')?.recallCount ?? 0,
    repairCount: series.remedyOptions.find((entry) => entry.option === 'Repair')?.recallCount ?? 0,
    topCountryCount: topCountry.recallCount,
    topCountrySharePercent: (topCountry.recallCount / series.totalRecalls) * 100,
    countryCount: series.manufacturerCountries.length,
  };
}

/**
 * Reads the consumer product recall file at build time.
 *
 * Falls back to the committed snapshot when the service is slow or
 * unreachable. The fallback is logged, not swallowed.
 *
 * @returns the chart bars and the figures the story renders
 */
export async function fetchCpscProductRecallStory(): Promise<CpscProductRecallStory> {
  const timeoutFetch: typeof globalThis.fetch = (input, init) =>
    globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS) });
  try {
    return buildCpscProductRecallStory(await fetchCpscProductRecalls({ fetchImpl: timeoutFetch }));
  } catch (error) {
    console.warn(
      `Falling back to the committed CPSC recall snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    const snapshot = JSON.parse(readFileSync(CPSC_RECALL_FIXTURE_PATH, 'utf8')) as unknown;
    return buildCpscProductRecallStory(parseCpscRecallSnapshot(snapshot));
  }
}
