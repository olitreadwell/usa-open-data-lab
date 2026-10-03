import {
  buildNceiAnnualTemperatureSeries,
  parseNceiAnnualTemperatureCsv,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  buildUsTemperatureStory,
  decadeLabelFor,
  fetchUsTemperatureStory,
  twentiethCenturyMean,
  usTemperatureUrl,
} from './us-temperature-data';

const FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/ncei-annual-temperature-2026-09-26.csv',
);
const RAW_FIXTURE = readFileSync(FIXTURE_PATH, 'utf8');
const SERIES = buildNceiAnnualTemperatureSeries(parseNceiAnnualTemperatureCsv(RAW_FIXTURE));
const STORY = buildUsTemperatureStory(SERIES);

describe('decadeLabelFor', () => {
  it('names the decade a year sits in', () => {
    expect(decadeLabelFor(1895)).toBe('1890s');
    expect(decadeLabelFor(1900)).toBe('1900s');
    expect(decadeLabelFor(2025)).toBe('2020s');
  });
});

describe('twentiethCenturyMean', () => {
  it('averages the years from 1901 to 2000', () => {
    expect(
      twentiethCenturyMean([
        { year: 1901, valueFahrenheit: 50 },
        { year: 2000, valueFahrenheit: 54 },
        { year: 1895, valueFahrenheit: 10 },
        { year: 2025, valueFahrenheit: 99 },
      ]),
    ).toBeCloseTo(52, 6);
  });

  it('refuses a record with no 20th century years', () => {
    expect(() => twentiethCenturyMean([{ year: 2025, valueFahrenheit: 54.62 }])).toThrow(
      /20th century/,
    );
  });
});

describe('buildUsTemperatureStory', () => {
  it('reads every year in the record, oldest first', () => {
    expect(STORY.yearCount).toBe(131);
    expect(STORY.firstYear).toBe(1895);
    expect(STORY.lastYear).toBe(2025);
    expect(STORY.points[0]).toEqual({
      year: 1895,
      valueFahrenheit: 50.33,
      decadeLabel: '1890s',
      changeFromTwentiethCentury: expect.closeTo(-1.68, 2),
    });
    const order = STORY.points.map((point) => point.year);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });

  it('picks out the warmest and coldest years', () => {
    expect(STORY.warmest.year).toBe(2024);
    expect(STORY.warmest.valueFahrenheit).toBe(55.48);
    expect(STORY.coldest.year).toBe(1917);
    expect(STORY.coldest.valueFahrenheit).toBe(50.05);
  });

  it('measures every year against the 20th century average', () => {
    expect(STORY.twentiethCenturyMean).toBeCloseTo(52.01, 2);
    expect(STORY.latest.year).toBe(2025);
    expect(STORY.latestChange).toBeCloseTo(2.61, 2);
  });

  it('counts the recent years that came in above that average', () => {
    expect(STORY.recentYearCount).toBe(26);
    expect(STORY.recentAboveCount).toBe(26);
  });

  it('stacks the decade rows from the oldest to the newest', () => {
    expect(STORY.decadeLabels[0]).toBe('1890s');
    expect(STORY.decadeLabels[STORY.decadeLabels.length - 1]).toBe('2020s');
    expect(STORY.decadeLabels).toHaveLength(14);
  });
});

/** Mean of the years in one span, straight from the snapshot. */
function meanOverYears(firstYear: number, lastYear: number): number {
  const inRange = SERIES.years.filter((row) => row.year >= firstYear && row.year <= lastYear);
  return inRange.reduce((total, row) => total + row.valueFahrenheit, 0) / inRange.length;
}

describe('the figures the story copy quotes', () => {
  it('reads the decade means it names out of the snapshot', () => {
    expect(meanOverYears(1930, 1939)).toBeCloseTo(52.626, 3);
    expect(meanOverYears(2020, 2025)).toBeCloseTo(54.45, 3);
    expect(meanOverYears(2020, 2025) - meanOverYears(1930, 1939)).toBeCloseTo(1.82, 2);
    expect(STORY.warmest.valueFahrenheit - STORY.coldest.valueFahrenheit).toBeCloseTo(5.43, 2);
  });

  it('finds no warmer decade than the 1930s in the first 85 years', () => {
    const earlierDecades = [1895, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970].map((start) =>
      meanOverYears(start, Math.min(start + 9, 1979)),
    );
    expect(Math.max(...earlierDecades)).toBeCloseTo(meanOverYears(1930, 1939), 6);
  });
});

describe('usTemperatureUrl', () => {
  it('asks for the whole record, ending with the current year', () => {
    expect(usTemperatureUrl(new Date(Date.UTC(2026, 8, 26)))).toBe(
      'https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/national/time-series/110/tavg/12/12/1895-2026.csv',
    );
  });
});

describe('fetchUsTemperatureStory', () => {
  it('reads the download and builds the story', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(url);
        return new Response(RAW_FIXTURE, { status: 200 });
      }),
    );
    const story = await fetchUsTemperatureStory(new Date(Date.UTC(2026, 8, 26)));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('ncei.noaa.gov');
    expect(seen[0]).toContain('1895-2026.csv');
    expect(story.yearCount).toBe(131);
    expect(story.warmest.year).toBe(2024);
  });

  it('falls back to the committed snapshot when the fetch rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const story = await fetchUsTemperatureStory();
    expect(story.yearCount).toBe(131);
    expect(story.lastYear).toBe(2025);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('temperature snapshot'));
  });

  it('falls back on a non-200 reply', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })));
    const story = await fetchUsTemperatureStory();
    expect(story.coldest.year).toBe(1917);
  });
});
