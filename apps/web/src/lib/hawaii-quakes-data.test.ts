import {
  buildUsgsEarthquakeCatalogue,
  parseUsgsEarthquakes,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildHawaiiQuakeStory,
  buildMagnitudeBands,
  fetchHawaiiQuakes,
  quakeDateLabel,
} from './hawaii-quakes-data';

const FIXTURE_PATH = path.join(process.cwd(), 'src/fixtures/usgs-hawaii-earthquakes.json');
const RAW_FIXTURE = readFileSync(FIXTURE_PATH, 'utf8');
const CATALOGUE = buildUsgsEarthquakeCatalogue(
  parseUsgsEarthquakes(JSON.parse(RAW_FIXTURE) as unknown),
);

describe('buildMagnitudeBands', () => {
  it('counts the year into half-magnitude bands, lowest first', () => {
    const bands = buildMagnitudeBands(CATALOGUE.earthquakes, { startMagnitude: 2.5, width: 0.5 });
    expect(bands).toEqual([
      { label: '2.5 up to 3.0', count: 176 },
      { label: '3.0 up to 3.5', count: 65 },
      { label: '3.5 up to 4.0', count: 18 },
      { label: '4.0 up to 4.5', count: 5 },
    ]);
  });

  it('puts an earthquake on a band edge in the upper band', () => {
    const bands = buildMagnitudeBands(
      [
        { id: 'a', magnitude: 2.5, place: 'a', timeMs: 1, depthKm: 1, url: 'u' },
        { id: 'b', magnitude: 2.99, place: 'b', timeMs: 2, depthKm: 1, url: 'u' },
        { id: 'c', magnitude: 3, place: 'c', timeMs: 3, depthKm: 1, url: 'u' },
      ],
      { startMagnitude: 2.5, width: 0.5 },
    );
    expect(bands).toEqual([
      { label: '2.5 up to 3.0', count: 2 },
      { label: '3.0 up to 3.5', count: 1 },
    ]);
  });

  it('throws when there is nothing to band', () => {
    expect(() => buildMagnitudeBands([], { startMagnitude: 2.5, width: 0.5 })).toThrow(
      /No earthquakes to band/,
    );
  });
});

describe('buildHawaiiQuakeStory', () => {
  it('keeps the count, the weak-quake count, and the headline quakes', () => {
    const story = buildHawaiiQuakeStory(CATALOGUE);
    expect(story.count).toBe(264);
    expect(story.belowMagnitude3).toBe(176);
    expect(story.strongest.magnitude).toBe(4.41);
    expect(story.strongest.place).toBe('53 km W of Hawaiian Ocean View, Hawaii');
    expect(story.deepest.depthKm).toBe(59.8);
    expect(story.strongestLabel).toBe('15 Mar 2025');
    expect(story.deepestLabel).toBe('22 Feb 2025');
    expect(story.bands).toHaveLength(4);
  });
});

describe('quakeDateLabel', () => {
  it('labels the origin date in UTC', () => {
    expect(quakeDateLabel({ timeMs: Date.UTC(2025, 2, 15, 6, 30) })).toBe('15 Mar 2025');
    expect(quakeDateLabel({ timeMs: Date.UTC(2025, 11, 31, 23, 59) })).toBe('31 Dec 2025');
  });
});

describe('fetchHawaiiQuakes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads the live catalogue for the 2025 window', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(url);
        return new Response(RAW_FIXTURE, { status: 200 });
      }),
    );
    const story = await fetchHawaiiQuakes();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('starttime=2025-01-01');
    expect(seen[0]).toContain('minmagnitude=2.5');
    expect(story.count).toBe(264);
  });

  it('falls back to the committed snapshot when the fetch rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const story = await fetchHawaiiQuakes();
    expect(story.count).toBe(264);
    expect(story.strongest.magnitude).toBe(4.41);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('earthquake snapshot'));
  });

  it('falls back on a non-200 reply', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 429 })));
    const story = await fetchHawaiiQuakes();
    expect(story.deepestLabel).toBe('22 Feb 2025');
  });
});
