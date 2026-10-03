import {
  buildNceiAnnualTemperatureSeries,
  buildNceiAnnualTemperatureUrl,
  NCEI_FIRST_RECORD_YEAR,
  parseNceiAnnualTemperatureCsv,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type {
  NceiTemperatureSeries,
  NceiTemperatureYear,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** First year of the 20th century average the agency publishes against. */
export const TWENTIETH_CENTURY_START_YEAR = 1901;

/** Last year of that average. */
export const TWENTIETH_CENTURY_END_YEAR = 2000;

/** First year of the recent run the story counts warm years over. */
export const RECENT_YEARS_START_YEAR = 2000;

export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when the agency host is
// slow or unreachable from the build runner.
const US_TEMPERATURE_FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/ncei-annual-temperature-2026-09-26.csv',
);

/** One year on the strip chart. */
export interface TemperatureYearPoint {
  year: number;
  /** Mean temperature for the year, in degrees Fahrenheit. */
  valueFahrenheit: number;
  /** The row the point sits in, e.g. "1990s". */
  decadeLabel: string;
  /** Difference from the 20th century average, in degrees Fahrenheit. */
  changeFromTwentiethCentury: number;
}

/** The story's numbers, all read from the series at deploy time. */
export interface UsTemperatureStory {
  /** Every year in the record, oldest first. */
  points: TemperatureYearPoint[];
  /** Decade rows for the chart, oldest first. */
  decadeLabels: string[];
  yearCount: number;
  firstYear: number;
  lastYear: number;
  warmest: TemperatureYearPoint;
  coldest: TemperatureYearPoint;
  /** The newest year in the record. */
  latest: TemperatureYearPoint;
  /** How far that year sits from the 20th century average. */
  latestChange: number;
  twentiethCenturyMean: number;
  /** Years from 2000 on, and how many of them came in above the average. */
  recentYearCount: number;
  recentAboveCount: number;
}

/**
 * The decade row a year belongs to, e.g. "1990s".
 *
 * The record opens in 1895, so the "1890s" row holds five years, and the
 * newest row holds the years published so far.
 *
 * @param year - the year to label
 * @returns the decade label used for the chart rows
 */
export function decadeLabelFor(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

/**
 * The 20th century average in the record, in degrees Fahrenheit.
 *
 * This is the average NCEI publishes against, so a year can be described as
 * warmer or cooler than it without reaching for a second source.
 *
 * @param years - the years in the record
 * @returns the mean of the years from 1901 to 2000
 */
export function twentiethCenturyMean(years: NceiTemperatureYear[]): number {
  const inCentury = years.filter(
    (row) => row.year >= TWENTIETH_CENTURY_START_YEAR && row.year <= TWENTIETH_CENTURY_END_YEAR,
  );
  if (inCentury.length === 0) {
    throw new UsSourceError('No 20th century years in the record to average');
  }
  return inCentury.reduce((total, row) => total + row.valueFahrenheit, 0) / inCentury.length;
}

/**
 * Turns the annual series into the points and headline figures the page renders.
 *
 * @param series - the parsed annual temperature series
 * @returns the chart points, the decade rows, and the headline years
 */
export function buildUsTemperatureStory(series: NceiTemperatureSeries): UsTemperatureStory {
  const mean = twentiethCenturyMean(series.years);
  const points: TemperatureYearPoint[] = series.years.map((row) => ({
    year: row.year,
    valueFahrenheit: row.valueFahrenheit,
    decadeLabel: decadeLabelFor(row.year),
    changeFromTwentiethCentury: row.valueFahrenheit - mean,
  }));

  const latest = points[points.length - 1];
  const warmest = points.find((point) => point.year === series.warmest.year);
  const coldest = points.find((point) => point.year === series.coldest.year);
  if (latest === undefined || warmest === undefined || coldest === undefined) {
    throw new UsSourceError('The temperature record is missing a headline year');
  }

  const recent = points.filter((point) => point.year >= RECENT_YEARS_START_YEAR);

  return {
    points,
    decadeLabels: [...new Set(points.map((point) => point.decadeLabel))],
    yearCount: series.yearCount,
    firstYear: series.firstYear,
    lastYear: series.lastYear,
    warmest,
    coldest,
    latest,
    latestChange: latest.changeFromTwentiethCentury,
    twentiethCenturyMean: mean,
    recentYearCount: recent.length,
    recentAboveCount: recent.filter((point) => point.changeFromTwentiethCentury > 0).length,
  };
}

/**
 * The download URL for the record, ending with the current year.
 *
 * The window rolls forward with the calendar. A year only joins the file once
 * December has closed it, so the newest row is the last complete year rather
 * than a partial one.
 *
 * @param now - the day to read the window from, for tests
 * @returns the Climate at a Glance CSV URL
 */
export function usTemperatureUrl(now: Date = new Date()): string {
  return buildNceiAnnualTemperatureUrl({
    startYear: NCEI_FIRST_RECORD_YEAR,
    endYear: now.getUTCFullYear(),
  });
}

/**
 * Reads the annual temperature record at build time.
 *
 * Falls back to the committed snapshot when the download is slow or
 * unreachable. The fallback is logged, not swallowed.
 *
 * @param now - the day to read the window from, for tests
 * @returns the chart points and headline figures the story renders
 */
export async function fetchUsTemperatureStory(now: Date = new Date()): Promise<UsTemperatureStory> {
  const url = usTemperatureUrl(now);
  try {
    const response = await globalThis.fetch(url, {
      signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return buildUsTemperatureStory(
      buildNceiAnnualTemperatureSeries(parseNceiAnnualTemperatureCsv(await response.text())),
    );
  } catch (error) {
    console.warn(
      `Falling back to the committed temperature snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    return buildUsTemperatureStory(
      buildNceiAnnualTemperatureSeries(
        parseNceiAnnualTemperatureCsv(readFileSync(US_TEMPERATURE_FIXTURE_PATH, 'utf8')),
      ),
    );
  }
}
