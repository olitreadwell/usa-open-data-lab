import {
  buildCdcCountyObesitySet,
  parseCdcCountyObesityPayload,
} from '@usa-open-data-connectors/usa-sources';
import type { CdcCountyObesityEstimate } from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bandLabelForPercent,
  buildCdcObesityStory,
  buildObesityBands,
  fetchCdcObesityStory,
  medianObesityPercent,
  populationWeightedObesityPercent,
} from './cdc-obesity-data';

const FIXTURE_PATH = path.join(process.cwd(), 'src/fixtures/cdc-county-obesity-2026-09-25.json');
const RAW_FIXTURE = readFileSync(FIXTURE_PATH, 'utf8');
const RELEASE = buildCdcCountyObesitySet(
  parseCdcCountyObesityPayload(JSON.parse(RAW_FIXTURE) as unknown),
);

/** One county estimate, with the fields the story reads. */
function county(countyName: string, percent: number, population: number): CdcCountyObesityEstimate {
  return { countyName, stateAbbr: 'CO', percent, population };
}

describe('buildObesityBands', () => {
  it('counts the release into two-point bands, lowest first', () => {
    const bands = buildObesityBands(RELEASE.counties, { width: 2 });
    expect(bands).toHaveLength(19);
    expect(bands[0]).toEqual({
      label: '16%',
      rangeLabel: '16 up to 18 percent',
      lower: 16,
      upper: 18,
      count: 2,
    });
    expect(bands[bands.length - 1]).toEqual({
      label: '52%',
      rangeLabel: '52 up to 54 percent',
      lower: 52,
      upper: 54,
      count: 3,
    });
    expect(bands.reduce((total, band) => total + band.count, 0)).toBe(2956);
  });

  it('puts a county on a band edge in the upper band', () => {
    const bands = buildObesityBands(
      [county('Low', 17.9, 100), county('Edge', 18, 100), county('High', 18.4, 100)],
      { width: 2 },
    );
    expect(bands).toEqual([
      {
        label: '16%',
        rangeLabel: '16 up to 18 percent',
        lower: 16,
        upper: 18,
        count: 1,
      },
      {
        label: '18%',
        rangeLabel: '18 up to 20 percent',
        lower: 18,
        upper: 20,
        count: 2,
      },
    ]);
  });

  it('throws when there is nothing to band', () => {
    expect(() => buildObesityBands([], { width: 2 })).toThrow(/No counties to band/);
  });
});

describe('bandLabelForPercent', () => {
  it('places a figure in the band that holds it', () => {
    const bands = buildObesityBands(RELEASE.counties, { width: 2 });
    expect(bandLabelForPercent(bands, 32.8)).toBe('32%');
    expect(bandLabelForPercent(bands, 37.9)).toBe('36%');
  });

  it('falls back to the last band when the figure is above the range', () => {
    const bands = buildObesityBands(RELEASE.counties, { width: 2 });
    expect(bandLabelForPercent(bands, 60)).toBe('52%');
    expect(bandLabelForPercent([], 32.8)).toBeUndefined();
  });
});

describe('medianObesityPercent', () => {
  it('takes the middle county of the release', () => {
    expect(medianObesityPercent(RELEASE.counties)).toBeCloseTo(37.9, 1);
  });

  it('averages the two middle counties when the count is even', () => {
    const counties = [county('a', 20, 1), county('b', 30, 1)];
    expect(medianObesityPercent(counties)).toBe(25);
  });

  it('picks the middle county when the count is odd', () => {
    const counties = [county('a', 20, 1), county('b', 30, 1), county('c', 52, 1)];
    expect(medianObesityPercent(counties)).toBe(30);
  });

  it('throws when there are no counties', () => {
    expect(() => medianObesityPercent([])).toThrow(/No counties to take a median from/);
  });
});

describe('populationWeightedObesityPercent', () => {
  it('weights the release by population, which sits below the median county', () => {
    const weighted = populationWeightedObesityPercent(RELEASE.counties);
    expect(weighted).toBeCloseTo(33.28, 1);
    expect(weighted).toBeLessThan(medianObesityPercent(RELEASE.counties));
  });

  it('weights a big county more than a small one', () => {
    const counties = [county('small', 50, 10), county('big', 30, 90)];
    expect(populationWeightedObesityPercent(counties)).toBe(32);
  });

  it('throws when there are no counties', () => {
    expect(() => populationWeightedObesityPercent([])).toThrow(/No counties to weight/);
  });
});

describe('buildCdcObesityStory', () => {
  it('keeps the count, the extremes, and the comparison with the national row', () => {
    const story = buildCdcObesityStory(RELEASE);
    expect(story.countyCount).toBe(2956);
    expect(story.lowest).toMatchObject({ countyName: 'Boulder', stateAbbr: 'CO', percent: 16.7 });
    expect(story.highest).toMatchObject({ countyName: 'Perry', stateAbbr: 'AL', percent: 52.9 });
    expect(story.medianPercent).toBeCloseTo(37.9, 1);
    expect(story.weightedPercent).toBeCloseTo(33.28, 1);
    expect(story.nationalPercent).toBe(32.8);
    expect(story.aboveNationalCount).toBe(2502);
    expect(story.dataYear).toBe(2023);
    expect(story.bands).toHaveLength(19);
  });
});

describe('fetchCdcObesityStory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads the live release in one request', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(url);
        return new Response(RAW_FIXTURE, { status: 200 });
      }),
    );
    const story = await fetchCdcObesityStory();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('data.cdc.gov');
    expect(seen[0]).toContain('measureid');
    expect(story.countyCount).toBe(2956);
  });

  it('falls back to the committed snapshot when the fetch rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const story = await fetchCdcObesityStory();
    expect(story.countyCount).toBe(2956);
    expect(story.highest.percent).toBe(52.9);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('CDC obesity snapshot'));
  });

  it('falls back on a non-200 reply', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 429 })));
    const story = await fetchCdcObesityStory();
    expect(story.medianPercent).toBeCloseTo(37.9, 1);
  });
});
