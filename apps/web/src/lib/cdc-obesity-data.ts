import {
  buildCdcCountyObesitySet,
  buildCdcCountyObesityUrl,
  parseCdcCountyObesityPayload,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type {
  CdcCountyObesityEstimate,
  CdcCountyObesitySet,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// The CDC PLACES county release for adult obesity. Keyless, public domain,
// published by the agency that runs the survey behind the estimates.
export const CDC_OBESITY_URL = buildCdcCountyObesityUrl();

/** Width of one bar on the chart, in percentage points. */
export const OBESITY_BAND_WIDTH = 2;

export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when the CDC endpoint
// is slow or unreachable from the build runner.
const CDC_OBESITY_FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/cdc-county-obesity-2026-09-25.json',
);

/** One bar on the chart: the counties inside one band of prevalence. */
export interface ObesityPercentBand {
  /** Short axis label, e.g. "36%". */
  label: string;
  /** Full band, for the tooltip and the table, e.g. "36 up to 38 percent". */
  rangeLabel: string;
  /** Lower edge of the band, in percent, inclusive. */
  lower: number;
  /** Upper edge of the band, in percent, exclusive. */
  upper: number;
  count: number;
}

/** The story's numbers, all read from the release at deploy time. */
export interface CdcObesityStory {
  bands: ObesityPercentBand[];
  countyCount: number;
  lowest: CdcCountyObesityEstimate;
  highest: CdcCountyObesityEstimate;
  /** The county in the middle of the distribution, in percent. */
  medianPercent: number;
  /** The same counties weighted by population, which is closer to a person. */
  weightedPercent: number;
  /** The release's own United States row, in percent. */
  nationalPercent: number;
  /** Counties above the release's national figure. */
  aboveNationalCount: number;
  dataYear: number;
}

/**
 * Counts counties into bands of two percentage points.
 *
 * The first band starts at the even number below the lowest county, so the
 * shortest counties are in the first bar rather than in a band of their own.
 * The last band is closed at the top, so the highest county lands inside it.
 *
 * @param counties - the county estimates
 * @param options - the width of one band, in percentage points
 * @returns one band per step, lowest first
 */
export function buildObesityBands(
  counties: CdcCountyObesityEstimate[],
  options: { width: number },
): ObesityPercentBand[] {
  const { width } = options;
  if (counties.length === 0) {
    throw new UsSourceError('No counties to band');
  }

  const lowest = Math.min(...counties.map((county) => county.percent));
  const highest = Math.max(...counties.map((county) => county.percent));
  const start = Math.floor(lowest / width) * width;
  const bandCount = Math.floor((highest - start) / width) + 1;
  const counts = new Array<number>(bandCount).fill(0);

  for (const county of counties) {
    const rawIndex = Math.floor((county.percent - start) / width);
    const index = Math.min(Math.max(rawIndex, 0), bandCount - 1);
    counts[index] = (counts[index] ?? 0) + 1;
  }

  return counts.map((count, index) => {
    const lower = start + index * width;
    const upper = lower + width;
    return {
      label: `${lower}%`,
      rangeLabel: `${lower} up to ${upper} percent`,
      lower,
      upper,
      count,
    };
  });
}

/**
 * Finds the band a percentage falls in.
 *
 * Used to place a reference line. A percentage above the last band, which a
 * rounded national figure can be, lands in the last band rather than nowhere.
 *
 * @param bands - the chart's bands
 * @param percent - the percentage to place
 * @returns the label of the band holding it, or undefined when there are no bands
 */
export function bandLabelForPercent(
  bands: ObesityPercentBand[],
  percent: number,
): string | undefined {
  const band = bands.find((candidate) => percent >= candidate.lower && percent < candidate.upper);
  return (band ?? bands[bands.length - 1])?.label;
}

/**
 * Median share of adults with obesity across the counties.
 *
 * @param counties - the county estimates, in any order
 * @returns the median percentage
 */
export function medianObesityPercent(counties: CdcCountyObesityEstimate[]): number {
  if (counties.length === 0) {
    throw new UsSourceError('No counties to take a median from');
  }
  const percents = [...counties.map((county) => county.percent)].sort(
    (left, right) => left - right,
  );
  const middle = Math.floor(percents.length / 2);
  if (percents.length % 2 === 1) {
    return percents[middle] ?? 0;
  }
  const lower = percents[middle - 1] ?? 0;
  const upper = percents[middle] ?? 0;
  return (lower + upper) / 2;
}

/**
 * Share of adults with obesity across the counties, weighted by population.
 *
 * A median county and a median person are not the same thing: the counties
 * with the highest rates are mostly small, so weighting the estimates by how
 * many people live in each one brings the average down towards the national
 * figure the release publishes itself.
 *
 * @param counties - the county estimates, in any order
 * @returns the population-weighted percentage
 */
export function populationWeightedObesityPercent(counties: CdcCountyObesityEstimate[]): number {
  if (counties.length === 0) {
    throw new UsSourceError('No counties to weight');
  }
  let weighted = 0;
  let population = 0;
  for (const county of counties) {
    weighted += county.percent * county.population;
    population += county.population;
  }
  return weighted / population;
}

/**
 * Turns the release into the bands and headline figures the story renders.
 *
 * @param set - the parsed PLACES release
 * @returns the chart bands plus the median, the weighted rate, and the extremes
 */
export function buildCdcObesityStory(set: CdcCountyObesitySet): CdcObesityStory {
  return {
    bands: buildObesityBands(set.counties, { width: OBESITY_BAND_WIDTH }),
    countyCount: set.countyCount,
    lowest: set.lowest,
    highest: set.highest,
    medianPercent: medianObesityPercent(set.counties),
    weightedPercent: populationWeightedObesityPercent(set.counties),
    nationalPercent: set.national.percent,
    aboveNationalCount: set.counties.filter((county) => county.percent > set.national.percent)
      .length,
    dataYear: set.dataYear,
  };
}

/**
 * Reads the county estimates at build time.
 *
 * Falls back to the committed snapshot when the endpoint is slow or
 * unreachable. The fallback is logged, not swallowed.
 *
 * @returns the bands and headline figures the story renders
 */
export async function fetchCdcObesityStory(): Promise<CdcObesityStory> {
  try {
    const response = await globalThis.fetch(CDC_OBESITY_URL, {
      signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${CDC_OBESITY_URL}`);
    }
    return buildCdcObesityStory(
      buildCdcCountyObesitySet(parseCdcCountyObesityPayload(await response.json())),
    );
  } catch (error) {
    console.warn(
      `Falling back to the committed CDC obesity snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    const snapshot = JSON.parse(readFileSync(CDC_OBESITY_FIXTURE_PATH, 'utf8')) as unknown;
    return buildCdcObesityStory(buildCdcCountyObesitySet(parseCdcCountyObesityPayload(snapshot)));
  }
}
