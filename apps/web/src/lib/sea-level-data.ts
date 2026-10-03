import {
  buildNoaaSeaLevelSeries,
  buildNoaaSeaLevelUrl,
  NOAA_BATTERY_STATION_ID,
  NOAA_SEA_LEVEL_FIRST_YEAR,
  parseNoaaSeaLevelPayload,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type { NoaaSeaLevelSeries, NoaaSeaLevelYear } from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Inches in a metre, for the headline figure the page leads with. */
export const INCHES_PER_METRE = 39.3701;

/** Millimetres in a metre, for turning the trend into the units the chart uses. */
const MILLIMETRES_PER_METRE = 1000;

/** How many of the highest years in the record the story counts. */
export const HIGHEST_YEARS_COUNTED = 10;

export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when the agency host is
// slow or unreachable from the build runner.
const SEA_LEVEL_FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/noaa-sea-level-2026-09-27.json',
);

/** One year on the dot plot. */
export interface SeaLevelYearPoint {
  year: number;
  /** Mean sea level for the year, in metres against the tidal datum. */
  meanSeaLevelMeters: number;
  /** Months that went into the average. A complete year holds twelve. */
  monthCount: number;
}

/** The story's numbers, all read from the gauge's record at deploy time. */
export interface SeaLevelStory {
  /** Station name as the agency publishes it, e.g. "The Battery". */
  stationName: string;
  /** Every year with a value, oldest first. */
  points: SeaLevelYearPoint[];
  yearCount: number;
  /** Calendar years inside the span that carry no monthly value at all. */
  missingYearCount: number;
  firstYear: SeaLevelYearPoint;
  lastYear: SeaLevelYearPoint;
  highest: SeaLevelYearPoint;
  lowest: SeaLevelYearPoint;
  /** Change from the first year to the last, in metres and in inches. */
  riseMeters: number;
  riseInches: number;
  /** Least-squares trend through the annual means, in millimetres per year. */
  trendMillimetresPerYear: number;
  /** Where that fitted line sits at the first and last year, in metres. */
  trendStartMeters: number;
  trendEndMeters: number;
  /** Earliest year among the highest years counted, for the "all since" line. */
  highestYearsStartYear: number;
}

/**
 * Turns a gauge's annual series into the points and headline figures the page renders.
 *
 * @param series - the parsed sea level series
 * @returns the chart points and the figures the story leans on
 */
export function buildSeaLevelStory(series: NoaaSeaLevelSeries): SeaLevelStory {
  const points: SeaLevelYearPoint[] = series.years.map((row) => ({
    year: row.year,
    meanSeaLevelMeters: row.meanSeaLevelMeters,
    monthCount: row.monthCount,
  }));

  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) {
    throw new UsSourceError('No years in the sea level record');
  }

  const toPoint = (row: NoaaSeaLevelYear): SeaLevelYearPoint => {
    const point = points.find((candidate) => candidate.year === row.year);
    if (point === undefined) {
      throw new UsSourceError(`The sea level record is missing ${row.year}`);
    }
    return point;
  };

  const highest = toPoint(series.highest);
  const lowest = toPoint(series.lowest);
  const spanYears = last.year - first.year + 1;
  const riseMeters = last.meanSeaLevelMeters - first.meanSeaLevelMeters;
  const meanYear = points.reduce((total, point) => total + point.year, 0) / points.length;
  const meanLevel =
    points.reduce((total, point) => total + point.meanSeaLevelMeters, 0) / points.length;
  const slopeMetersPerYear = series.trendMillimetresPerYear / MILLIMETRES_PER_METRE;
  const fittedAt = (year: number): number => meanLevel + slopeMetersPerYear * (year - meanYear);
  const highestYears = [...points]
    .sort((left, right) => right.meanSeaLevelMeters - left.meanSeaLevelMeters)
    .slice(0, HIGHEST_YEARS_COUNTED);

  return {
    stationName: series.station.name,
    points,
    yearCount: series.yearCount,
    missingYearCount: spanYears - series.yearCount,
    firstYear: first,
    lastYear: last,
    highest,
    lowest,
    riseMeters,
    riseInches: riseMeters * INCHES_PER_METRE,
    trendMillimetresPerYear: series.trendMillimetresPerYear,
    trendStartMeters: fittedAt(first.year),
    trendEndMeters: fittedAt(last.year),
    highestYearsStartYear: Math.min(...highestYears.map((point) => point.year)),
  };
}

/**
 * The download URL for the record, ending with the last complete year.
 *
 * The window rolls forward with the calendar. The current year joins the
 * record only once December has closed it, so the newest point is a whole
 * year rather than eight months of one.
 *
 * @param now - the day to read the window from, for tests
 * @returns the CO-OPS request URL
 */
export function seaLevelUrl(now: Date = new Date()): string {
  return buildNoaaSeaLevelUrl({
    stationId: NOAA_BATTERY_STATION_ID,
    startYear: NOAA_SEA_LEVEL_FIRST_YEAR,
    endYear: now.getUTCFullYear() - 1,
  });
}

/**
 * Reads the sea level record at build time.
 *
 * Falls back to the committed snapshot when the download is slow or
 * unreachable. The fallback is logged, not swallowed.
 *
 * @param now - the day to read the window from, for tests
 * @returns the chart points and the figures the story renders
 */
export async function fetchSeaLevelStory(now: Date = new Date()): Promise<SeaLevelStory> {
  const url = seaLevelUrl(now);
  try {
    const response = await globalThis.fetch(url, {
      signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return buildSeaLevelStory(
      buildNoaaSeaLevelSeries(parseNoaaSeaLevelPayload(await response.json())),
    );
  } catch (error) {
    console.warn(
      `Falling back to the committed sea level snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    return buildSeaLevelStory(
      buildNoaaSeaLevelSeries(
        parseNoaaSeaLevelPayload(
          JSON.parse(readFileSync(SEA_LEVEL_FIXTURE_PATH, 'utf8')) as unknown,
        ),
      ),
    );
  }
}
