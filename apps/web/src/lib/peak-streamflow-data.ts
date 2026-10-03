import {
  buildUsgsPeakStreamflowSeries,
  buildUsgsPeakStreamflowUrl,
  parseUsgsPeakStreamflowPayload,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type {
  UsgsPeakStreamflowSeries,
  UsgsPeakStreamflowYear,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// The USGS Water Data OGC API's peaks collection, read for the Mississippi
// River at St. Louis. Keyless, public domain, one row per water year.
export const PEAK_STREAMFLOW_URL = buildUsgsPeakStreamflowUrl();

/** Flow, in cubic feet per second, that marks a very big year on this river. */
export const BIG_PEAK_CUBIC_FEET_PER_SECOND = 900_000;

export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when the USGS host is
// slow or unreachable from the build runner.
const PEAK_STREAMFLOW_FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/usgs-peak-streamflow-2026-10-01.json',
);

/**
 * Month names, indexed from January.
 *
 * Spelled out here rather than read from the runtime's locale, so a label
 * cannot change with the build runner's settings.
 */
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

/** One bar on the chart: the highest flow in one water year. */
export interface PeakStreamflowBar {
  waterYear: number;
  /** Axis label, e.g. "1993". */
  label: string;
  /** Date the peak fell on, e.g. "1993-08-01". */
  peakDate: string;
  /** The same date written out, e.g. "1 August 1993". */
  peakDateLabel: string;
  dischargeCubicFeetPerSecond: number;
}

/** The story's numbers, all read from the peak-flow record at deploy time. */
export interface PeakStreamflowStory {
  bars: PeakStreamflowBar[];
  yearCount: number;
  firstWaterYear: number;
  lastWaterYear: number;
  /** The biggest peak on the record. */
  record: PeakStreamflowBar;
  /** The second biggest, which the copy names alongside the record. */
  runnerUp: PeakStreamflowBar;
  /** The smallest peak on the record. */
  lowest: PeakStreamflowBar;
  /** The newest water year filed. */
  latest: PeakStreamflowBar;
  medianDischargeCubicFeetPerSecond: number;
  /** Water years between the first and last that carry no row. */
  missingWaterYears: number[];
  /** Water years whose peak reached the big-peak threshold. */
  bigPeakYears: number[];
  /** Years between the first and last that carry no row, as a count. */
  missingYearCount: number;
}

/** Writes a peak date out in full, e.g. "1 August 1993". */
export function peakDateLabel(peakDate: string): string {
  const [year, month, day] = peakDate.split('-');
  const monthName = MONTH_NAMES[Number(month) - 1];
  if (year === undefined || day === undefined || monthName === undefined) {
    throw new UsSourceError(`Unreadable peak date: ${peakDate}`);
  }
  return `${String(Number(day))} ${monthName} ${year}`;
}

/**
 * Turns one water year's row into a chart bar.
 *
 * @param year - the row the adapter parsed
 * @returns the bar, with the date written out and the value in millions
 */
export function buildPeakStreamflowBar(year: UsgsPeakStreamflowYear): PeakStreamflowBar {
  return {
    waterYear: year.waterYear,
    label: String(year.waterYear),
    peakDate: year.peakDate,
    peakDateLabel: peakDateLabel(year.peakDate),
    dischargeCubicFeetPerSecond: year.peakDischargeCubicFeetPerSecond,
  };
}

/**
 * Turns the USGS peak-flow record into the bars and figures the story renders.
 *
 * @param series - the parsed and summarised peak-flow record
 * @returns the chart bars plus the figures the copy quotes
 */
export function buildPeakStreamflowStory(series: UsgsPeakStreamflowSeries): PeakStreamflowStory {
  const bars = series.years.map(buildPeakStreamflowBar);
  const record = buildPeakStreamflowBar(series.highest);
  const lowest = buildPeakStreamflowBar(series.lowest);
  const latest = buildPeakStreamflowBar(series.lastYear);

  const byValue = [...bars].sort(
    (left, right) => right.dischargeCubicFeetPerSecond - left.dischargeCubicFeetPerSecond,
  );
  const runnerUp = byValue[1];
  if (runnerUp === undefined) {
    throw new UsSourceError('No second year to name beside the record');
  }

  return {
    bars,
    yearCount: series.yearCount,
    firstWaterYear: series.firstYear.waterYear,
    lastWaterYear: series.lastYear.waterYear,
    record,
    runnerUp,
    lowest,
    latest,
    medianDischargeCubicFeetPerSecond: series.median.peakDischargeCubicFeetPerSecond,
    missingWaterYears: series.missingWaterYears,
    missingYearCount: series.missingWaterYears.length,
    bigPeakYears: bars
      .filter((bar) => bar.dischargeCubicFeetPerSecond >= BIG_PEAK_CUBIC_FEET_PER_SECOND)
      .map((bar) => bar.waterYear),
  };
}

/**
 * Reads the USGS peak-flow record for the Mississippi at St. Louis.
 *
 * Falls back to the committed snapshot when the endpoint is slow or
 * unreachable. The fallback is logged, not swallowed.
 *
 * @returns the chart bars and the figures the story renders
 */
export async function fetchPeakStreamflowStory(): Promise<PeakStreamflowStory> {
  try {
    const response = await globalThis.fetch(PEAK_STREAMFLOW_URL, {
      signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${PEAK_STREAMFLOW_URL}`);
    }
    return buildPeakStreamflowStory(
      buildUsgsPeakStreamflowSeries(parseUsgsPeakStreamflowPayload(await response.json())),
    );
  } catch (error) {
    console.warn(
      `Falling back to the committed peak-streamflow snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    const snapshot = JSON.parse(readFileSync(PEAK_STREAMFLOW_FIXTURE_PATH, 'utf8')) as unknown;
    return buildPeakStreamflowStory(
      buildUsgsPeakStreamflowSeries(parseUsgsPeakStreamflowPayload(snapshot)),
    );
  }
}
