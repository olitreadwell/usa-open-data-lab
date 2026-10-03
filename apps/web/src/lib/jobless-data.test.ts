import {
  buildBlsSeries,
  parseBlsObservations,
  US_UNEMPLOYMENT_SERIES_ID,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildJoblessSeries,
  fetchJoblessSeries,
  joblessWindowYears,
  monthLabel,
} from './jobless-data';

// A fixed day inside the window, so the tests do not change with the clock.
const WINDOW_NOW = new Date('2026-09-25T00:00:00Z');

const FIXTURE_PATH = path.join(process.cwd(), 'src/fixtures/bls-unemployment-rate.json');
const RAW_FIXTURE = readFileSync(FIXTURE_PATH, 'utf8');
const PARSED = buildBlsSeries(
  parseBlsObservations(JSON.parse(RAW_FIXTURE) as unknown),
  US_UNEMPLOYMENT_SERIES_ID,
);

describe('buildJoblessSeries', () => {
  it('lays out every month between the first and the last', () => {
    const series = buildJoblessSeries(PARSED);
    expect(series.points).toHaveLength(248);
    expect(series.points[0]).toEqual({ label: 'Jan 2006', value: 4.7 });
    expect(series.points[series.points.length - 1]).toEqual({ label: 'Aug 2026', value: 4.1 });
  });

  it('leaves the unpublished month empty rather than dropping it', () => {
    const series = buildJoblessSeries(PARSED);
    expect(series.missingMonthLabels).toEqual(['Oct 2025']);
    const gapMonths = series.points.filter((point) => point.value === null);
    expect(gapMonths).toHaveLength(1);
    expect(gapMonths[0]?.label).toBe('Oct 2025');
  });

  it('keeps the headline months and the change from the peak', () => {
    const series = buildJoblessSeries(PARSED);
    expect(series.peakLabel).toBe('Apr 2020');
    expect(series.peak.value).toBe(14.8);
    expect(series.lowestLabel).toBe('Apr 2023');
    expect(series.lowest.value).toBe(3.4);
    expect(series.latestLabel).toBe('Aug 2026');
    expect(series.changeFromPeak).toBeCloseTo(-10.7, 5);
  });

  it('throws when there is nothing to chart', () => {
    expect(() => buildJoblessSeries({ ...PARSED, points: [] })).toThrow(
      /No unemployment observations/,
    );
  });
});

describe('monthLabel', () => {
  it('shortens the month name', () => {
    expect(monthLabel({ year: 2020, periodName: 'April' })).toBe('Apr 2020');
    expect(monthLabel({ year: 2025, periodName: 'September' })).toBe('Sep 2025');
  });
});

describe('joblessWindowYears', () => {
  it('reads the twenty years ending with the current one', () => {
    expect(joblessWindowYears(new Date('2026-09-25T00:00:00Z'))).toEqual({
      startYear: 2007,
      endYear: 2026,
    });
  });

  it('rolls forward with the calendar', () => {
    expect(joblessWindowYears(new Date('2027-01-02T00:00:00Z'))).toEqual({
      startYear: 2008,
      endYear: 2027,
    });
  });
});

describe('fetchJoblessSeries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads the live series and stitches two windows together', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(url);
        return new Response(RAW_FIXTURE, { status: 200 });
      }),
    );
    const series = await fetchJoblessSeries(WINDOW_NOW);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toContain('startyear=2007');
    expect(seen[0]).toContain('endyear=2016');
    expect(seen[1]).toContain('startyear=2017');
    expect(seen[1]).toContain('endyear=2026');
    expect(series.latestLabel).toBe('Aug 2026');
    expect(series.latest.value).toBe(4.1);
  });

  it('falls back to the committed snapshot when the fetch rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const series = await fetchJoblessSeries(WINDOW_NOW);
    expect(series.points).toHaveLength(236);
    expect(series.points[0]).toEqual({ label: 'Jan 2007', value: 4.6 });
    expect(series.peak.value).toBe(14.8);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unemployment snapshot'));
  });

  it('falls back on a non-200 reply', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 429 })));
    const series = await fetchJoblessSeries(WINDOW_NOW);
    expect(series.latestLabel).toBe('Aug 2026');
  });
});
