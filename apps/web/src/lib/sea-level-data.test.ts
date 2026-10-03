import {
  buildNoaaSeaLevelSeries,
  parseNoaaSeaLevelPayload,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  buildSeaLevelStory,
  fetchSeaLevelStory,
  type SeaLevelStory,
  seaLevelUrl,
} from './sea-level-data';
import { formatInches, formatMetresChange, formatMillimetresPerYear } from './us-format';

const FIXTURE_PATH = path.join(process.cwd(), 'src/fixtures/noaa-sea-level-2026-09-27.json');
const RAW_FIXTURE = readFileSync(FIXTURE_PATH, 'utf8');
const SERIES = buildNoaaSeaLevelSeries(
  parseNoaaSeaLevelPayload(JSON.parse(RAW_FIXTURE) as unknown),
);
const STORY = buildSeaLevelStory(SERIES);

/** The annual mean for one year in the story, or a failure if it is missing. */
function meanOverYear(story: SeaLevelStory, year: number): number {
  const point = story.points.find((candidate) => candidate.year === year);
  if (point === undefined) {
    throw new Error(`No ${year} in the record`);
  }
  return point.meanSeaLevelMeters;
}

/** The average annual mean across a run of points. */
function meanOverPoints(points: SeaLevelStory['points']): number {
  return points.reduce((total, point) => total + point.meanSeaLevelMeters, 0) / points.length;
}

describe('buildSeaLevelStory', () => {
  it('reads every year with a value, oldest first', () => {
    expect(STORY.yearCount).toBe(155);
    expect(STORY.firstYear.year).toBe(1856);
    expect(STORY.lastYear.year).toBe(2025);
    expect(STORY.points[0]?.meanSeaLevelMeters).toBeCloseTo(-0.3635, 4);
    const order = STORY.points.map((point) => point.year);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });

  it('counts the calendar years inside the span with no value', () => {
    expect(STORY.missingYearCount).toBe(15);
    const present = new Set(STORY.points.map((point) => point.year));
    expect(present.has(1861)).toBe(false);
    expect(present.has(1885)).toBe(false);
    expect(present.has(1920)).toBe(true);
  });

  it('picks out the highest and lowest years in the record', () => {
    expect(STORY.highest.year).toBe(2024);
    expect(STORY.highest.meanSeaLevelMeters).toBeCloseTo(0.1993, 4);
    expect(STORY.lowest.year).toBe(1874);
    expect(STORY.lowest.meanSeaLevelMeters).toBeCloseTo(-0.3868, 4);
  });

  it('measures the rise from the first year to the last', () => {
    expect(STORY.riseMeters).toBeCloseTo(0.4814, 4);
    expect(formatInches(STORY.riseInches)).toBe('19 inches');
    expect(formatMetresChange(STORY.riseMeters)).toBe('+0.48 m');
    expect(formatMetresChange(meanOverYear(STORY, 1856))).toBe('-0.36 m');
    expect(formatMetresChange(meanOverYear(STORY, 2025))).toBe('+0.12 m');
    expect(formatMetresChange(STORY.lowest.meanSeaLevelMeters)).toBe('-0.39 m');
  });

  it('fits a trend just under three millimetres a year', () => {
    expect(formatMillimetresPerYear(STORY.trendMillimetresPerYear)).toBe('2.95 mm a year');
    expect(STORY.trendStartMeters).toBeCloseTo(-0.3934, 3);
    expect(STORY.trendEndMeters).toBeCloseTo(0.1047, 3);
  });

  it('finds the ten highest years all inside the last sixteen', () => {
    expect(STORY.highestYearsStartYear).toBe(2010);
    const tenHighest = [...STORY.points]
      .sort((left, right) => right.meanSeaLevelMeters - left.meanSeaLevelMeters)
      .slice(0, 10);
    expect(tenHighest.every((point) => point.year >= 2010)).toBe(true);
    expect(tenHighest.every((point) => point.year <= 2025)).toBe(true);
  });

  it('backs the decade averages the copy quotes', () => {
    const oldestTen = STORY.points.slice(0, 10);
    const newestTen = STORY.points.slice(-10);
    expect(oldestTen.map((point) => point.year)).toEqual([
      1856, 1857, 1858, 1859, 1860, 1862, 1863, 1864, 1865, 1866,
    ]);
    expect(newestTen[0]?.year).toBe(2016);
    expect(meanOverPoints(oldestTen)).toBeCloseTo(-0.354, 3);
    expect(meanOverPoints(newestTen)).toBeCloseTo(0.131, 3);
    const gap = meanOverPoints(newestTen) - meanOverPoints(oldestTen);
    expect(gap).toBeCloseTo(0.4857, 3);
    expect(formatMetresChange(gap)).toBe('+0.49 m');
  });

  it('keeps a year whose months are incomplete', () => {
    const partial = STORY.points.find((point) => point.year === 1920);
    expect(partial?.monthCount).toBe(7);
  });

  it('refuses a series with no years', () => {
    expect(() =>
      buildSeaLevelStory({
        station: { id: '8518750', name: 'The Battery' },
        years: [],
        yearCount: 0,
        firstYear: { year: 1856, meanSeaLevelMeters: 0, monthCount: 12 },
        lastYear: { year: 1856, meanSeaLevelMeters: 0, monthCount: 12 },
        highest: { year: 1856, meanSeaLevelMeters: 0, monthCount: 12 },
        lowest: { year: 1856, meanSeaLevelMeters: 0, monthCount: 12 },
        trendMillimetresPerYear: 0,
        changeFirstToLastMeters: 0,
      }),
    ).toThrow(/No years/);
  });
});

describe('seaLevelUrl', () => {
  it('asks for the whole record, ending with the last complete year', () => {
    const url = seaLevelUrl(new Date(Date.UTC(2026, 8, 27)));
    const params = new URL(url).searchParams;
    expect(params.get('begin_date')).toBe('18560101');
    expect(params.get('end_date')).toBe('20251231');
    expect(params.get('station')).toBe('8518750');
    expect(params.get('product')).toBe('monthly_mean');
  });
});

describe('fetchSeaLevelStory', () => {
  it('reads the download and builds the story', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(url);
        return new Response(RAW_FIXTURE, { status: 200 });
      }),
    );
    const story = await fetchSeaLevelStory(new Date(Date.UTC(2026, 8, 27)));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('tidesandcurrents.noaa.gov');
    expect(story.yearCount).toBe(155);
    expect(story.highest.year).toBe(2024);
  });

  it('falls back to the committed snapshot when the fetch rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const story = await fetchSeaLevelStory();
    expect(story.yearCount).toBe(155);
    expect(story.lastYear.year).toBe(2025);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sea level snapshot'));
  });

  it('falls back on a non-200 reply', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })));
    const story = await fetchSeaLevelStory();
    expect(story.lowest.year).toBe(1874);
  });
});
