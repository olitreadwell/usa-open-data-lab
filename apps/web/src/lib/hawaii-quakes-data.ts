import {
  buildUsgsEarthquakeCatalogue,
  buildUsgsEarthquakeUrl,
  parseUsgsEarthquakes,
  USGS_HAWAII_BOUNDS,
  USGS_HAWAII_MIN_MAGNITUDE,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type {
  UsgsEarthquake,
  UsgsEarthquakeCatalogue,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// The USGS earthquake catalogue (FDSN event query). Keyless, public domain,
// published by the agency that runs the seismic networks.
export const USGS_HAWAII_QUAKES_URL = buildUsgsEarthquakeUrl({
  startDate: '2025-01-01',
  endDate: '2026-01-01',
  minMagnitude: USGS_HAWAII_MIN_MAGNITUDE,
  bounds: USGS_HAWAII_BOUNDS,
});

/** The window the story covers: the 2025 calendar year, complete and fixed. */
export const HAWAII_QUAKES_START_DATE = '2025-01-01';
export const HAWAII_QUAKES_END_DATE = '2026-01-01';

/** Width of one bar on the chart, in magnitude units. */
export const QUAKE_MAGNITUDE_BAND_WIDTH = 0.5;

export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when the catalogue is
// slow or unreachable from the build runner.
const HAWAII_QUAKES_FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/usgs-hawaii-earthquakes.json',
);

/** One bar on the chart: the earthquakes inside a half-magnitude band. */
export interface QuakeMagnitudeBand {
  /** Human-readable band, e.g. "2.5 up to 3.0". */
  label: string;
  count: number;
}

/** The story's numbers, all read from the catalogue at deploy time. */
export interface HawaiiQuakeStory {
  bands: QuakeMagnitudeBand[];
  count: number;
  strongest: UsgsEarthquake;
  deepest: UsgsEarthquake;
  strongestLabel: string;
  deepestLabel: string;
  /** Earthquakes below magnitude 3, the band the page leans on. */
  belowMagnitude3: number;
}

/** Short date label for one earthquake, e.g. "15 Mar 2025", in UTC. */
export function quakeDateLabel(earthquake: Pick<UsgsEarthquake, 'timeMs'>): string {
  const date = new Date(earthquake.timeMs);
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

/**
 * Counts earthquakes into half-magnitude bands.
 *
 * A band holds magnitudes from its lower edge up to, but not including, the
 * next edge, so the strongest earthquake of the year lands in the last band
 * rather than past it.
 *
 * @param earthquakes - the catalogue's earthquakes
 * @param options - the lowest band edge, and the width of each band
 * @returns one band per magnitude step, lowest first
 */
export function buildMagnitudeBands(
  earthquakes: UsgsEarthquake[],
  options: { startMagnitude: number; width: number },
): QuakeMagnitudeBand[] {
  const { startMagnitude, width } = options;
  if (earthquakes.length === 0) {
    throw new UsSourceError('No earthquakes to band');
  }

  const highest = Math.max(...earthquakes.map((earthquake) => earthquake.magnitude));
  const bandCount = Math.floor((highest - startMagnitude) / width) + 1;
  const counts = new Array<number>(bandCount).fill(0);
  for (const earthquake of earthquakes) {
    const rawIndex = Math.floor((earthquake.magnitude - startMagnitude) / width);
    const index = Math.min(Math.max(rawIndex, 0), bandCount - 1);
    counts[index] = (counts[index] ?? 0) + 1;
  }

  return counts.map((count, index) => ({
    label: `${(startMagnitude + index * width).toFixed(1)} up to ${(startMagnitude + (index + 1) * width).toFixed(1)}`,
    count,
  }));
}

/**
 * Turns the catalogue into the bands and headline quakes the story renders.
 *
 * @param catalogue - the parsed USGS catalogue for the story's window
 * @returns the chart bands plus the strongest and deepest earthquakes
 */
export function buildHawaiiQuakeStory(catalogue: UsgsEarthquakeCatalogue): HawaiiQuakeStory {
  const bands = buildMagnitudeBands(catalogue.earthquakes, {
    startMagnitude: USGS_HAWAII_MIN_MAGNITUDE,
    width: QUAKE_MAGNITUDE_BAND_WIDTH,
  });

  return {
    bands,
    count: catalogue.count,
    strongest: catalogue.strongest,
    deepest: catalogue.deepest,
    strongestLabel: quakeDateLabel(catalogue.strongest),
    deepestLabel: quakeDateLabel(catalogue.deepest),
    belowMagnitude3: catalogue.earthquakes.filter((earthquake) => earthquake.magnitude < 3).length,
  };
}

/**
 * Reads the catalogue for the story's window at build time.
 *
 * Falls back to the committed snapshot when the catalogue is slow or
 * unreachable. The fallback is logged, not swallowed.
 *
 * @returns the bands and headline quakes the story renders
 */
export async function fetchHawaiiQuakes(): Promise<HawaiiQuakeStory> {
  try {
    const response = await globalThis.fetch(USGS_HAWAII_QUAKES_URL, {
      signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${USGS_HAWAII_QUAKES_URL}`);
    }
    return buildHawaiiQuakeStory(
      buildUsgsEarthquakeCatalogue(parseUsgsEarthquakes(await response.json())),
    );
  } catch (error) {
    console.warn(
      `Falling back to the committed earthquake snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    const snapshot = JSON.parse(readFileSync(HAWAII_QUAKES_FIXTURE_PATH, 'utf8')) as unknown;
    return buildHawaiiQuakeStory(buildUsgsEarthquakeCatalogue(parseUsgsEarthquakes(snapshot)));
  }
}
