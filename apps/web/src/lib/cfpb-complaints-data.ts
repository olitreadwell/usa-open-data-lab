import {
  fetchCfpConsumerComplaints,
  parseCfpComplaintSnapshot,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type {
  CfpComplaintYearCount,
  CfpConsumerComplaintSeries,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** How long a live request may take before the build falls back to the snapshot. */
export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when consumerfinance.gov
// is slow or unreachable from the build runner.
const CFPB_COMPLAINT_FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/cfpb-consumer-complaints-2026-10-03.json',
);

/** One bar on the chart: a calendar year of complaints. */
export interface CfpComplaintBar {
  year: number;
  /** Axis label, e.g. "2025". */
  label: string;
  /** Complaints the bureau sent to a company that year. */
  complaintCount: number;
  /** True for the newest year, which the bureau is still filling. */
  partial: boolean;
}

/** One company and its share of the complaints in the window. */
export interface CfpCompanyShare {
  company: string;
  complaintCount: number;
  /** Share of the complaints in the window, in percent. */
  sharePercent: number;
}

/** The story's numbers, all read from the complaint file at deploy time. */
export interface CfpConsumerComplaintStory {
  bars: CfpComplaintBar[];
  totalComplaints: number;
  firstYear: number;
  /** Newest year in the file, which is still open. */
  newestYear: number;
  /** Complaints against the newest year so far. */
  newestYearCount: number;
  /** Newest received date written out, e.g. "2 October 2026". */
  newestReceivedDateLabel: string;
  /** Busiest of the years before the newest one. */
  busiestCompleteYear: CfpComplaintYearCount;
  /** The companies named most often, for the list under the chart. */
  companies: CfpCompanyShare[];
  /** The company named most often, which the copy names. */
  topCompanyName: string;
  /** Its complaint count. */
  topCompanyCount: number;
  /** The three companies named most often, added up. */
  topThreeCount: number;
  /** Their share of the complaints in the window, in percent. */
  topThreeSharePercent: number;
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

/** How many companies the list under the chart shows. */
const COMPANY_ROWS_SHOWN = 5;

/**
 * Turns an ISO complaint date into the label the copy reads.
 *
 * @param isoDate - a date from the API, e.g. "2026-10-02"
 * @returns the same date as "2 October 2026"
 */
export function cfpbComplaintDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const monthName = MONTH_NAMES[Number(month) - 1];
  if (year === undefined || day === undefined || monthName === undefined) {
    throw new UsSourceError(`Unreadable complaint date: ${isoDate}`);
  }
  return `${String(Number(day))} ${monthName} ${year}`;
}

/**
 * Turns every year in the window into a bar, marking the newest one partial.
 *
 * @param series - the counted complaint file
 * @returns one bar per year, oldest first
 */
export function buildCfpComplaintBars(series: CfpConsumerComplaintSeries): CfpComplaintBar[] {
  if (series.years.length === 0) {
    throw new UsSourceError('No years to chart');
  }
  return series.years.map((year) => ({
    year: year.year,
    label: String(year.year),
    complaintCount: year.complaintCount,
    partial: year.year === series.newestYear,
  }));
}

/**
 * Turns the complaint file into the bars and figures the story renders.
 *
 * @param series - the counted complaint file
 * @returns the chart bars plus the figures the copy quotes
 */
export function buildCfpConsumerComplaintStory(
  series: CfpConsumerComplaintSeries,
): CfpConsumerComplaintStory {
  const topCompany = series.topCompanies[0];
  const newestYearRow = series.years[series.years.length - 1];
  if (topCompany === undefined || newestYearRow === undefined) {
    throw new UsSourceError('The complaint file has no newest year or company to summarise');
  }
  const topThree = series.topCompanies.slice(0, 3);
  const topThreeCount = topThree.reduce((sum, entry) => sum + entry.complaintCount, 0);

  return {
    bars: buildCfpComplaintBars(series),
    totalComplaints: series.totalComplaints,
    firstYear: series.firstYear,
    newestYear: series.newestYear,
    newestYearCount: newestYearRow.complaintCount,
    newestReceivedDateLabel: cfpbComplaintDateLabel(series.newestReceivedDate),
    busiestCompleteYear: series.busiestCompleteYear,
    companies: series.topCompanies.slice(0, COMPANY_ROWS_SHOWN).map((entry) => ({
      company: entry.company,
      complaintCount: entry.complaintCount,
      sharePercent: (entry.complaintCount / series.totalComplaints) * 100,
    })),
    topCompanyName: topCompany.company,
    topCompanyCount: topCompany.complaintCount,
    topThreeCount,
    topThreeSharePercent: (topThreeCount / series.totalComplaints) * 100,
  };
}

/**
 * Reads the consumer complaint file at build time.
 *
 * Falls back to the committed snapshot when the API is slow or unreachable.
 * The fallback is logged, not swallowed.
 *
 * @returns the chart bars and the figures the story renders
 */
export async function fetchCfpConsumerComplaintStory(): Promise<CfpConsumerComplaintStory> {
  const timeoutFetch: typeof globalThis.fetch = (input, init) =>
    globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS) });
  try {
    return buildCfpConsumerComplaintStory(
      await fetchCfpConsumerComplaints({ fetchImpl: timeoutFetch }),
    );
  } catch (error) {
    console.warn(
      `Falling back to the committed CFPB complaint snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    const snapshot = JSON.parse(readFileSync(CFPB_COMPLAINT_FIXTURE_PATH, 'utf8')) as unknown;
    return buildCfpConsumerComplaintStory(parseCfpComplaintSnapshot(snapshot));
  }
}
