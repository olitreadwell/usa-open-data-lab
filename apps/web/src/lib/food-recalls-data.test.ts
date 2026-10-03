import {
  buildOpenFdaFoodRecallSummary,
  parseOpenFdaFoodRecallSnapshot,
} from '@usa-open-data-connectors/usa-sources';
import type { OpenFdaFoodRecallYear } from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildFoodRecallBars,
  buildFoodRecallStory,
  fetchFoodRecallStory,
  foodRecallDateLabel,
} from './food-recalls-data';

const FIXTURE_PATH = path.join(process.cwd(), 'src/fixtures/openfda-food-recalls-2026-09-30.json');
const RAW_FIXTURE = readFileSync(FIXTURE_PATH, 'utf8');
const SNAPSHOT = parseOpenFdaFoodRecallSnapshot(JSON.parse(RAW_FIXTURE) as unknown);
const SUMMARY = buildOpenFdaFoodRecallSummary(SNAPSHOT);

/** Answers each openFDA request with the matching part of the committed file. */
function fixtureFetch(): typeof globalThis.fetch {
  return (async (input: string | URL) => {
    const url = new URL(String(input));
    const count = url.searchParams.get('count');
    if (count === 'report_date') {
      const rows =
        url.searchParams.get('search') === null
          ? SNAPSHOT.reportDates.map((entry) => ({ time: entry.date, count: entry.count }))
          : SNAPSHOT.classOneDates.map((entry) => ({ time: entry.date, count: entry.count }));
      return new Response(JSON.stringify({ results: rows }), { status: 200 });
    }
    if (count === 'classification.exact') {
      return new Response(
        JSON.stringify({
          results: SNAPSHOT.classifications.map((entry) => ({
            term: entry.name,
            count: entry.count,
          })),
        }),
        { status: 200 },
      );
    }
    if (count === 'voluntary_mandated.exact') {
      return new Response(
        JSON.stringify({
          results: SNAPSHOT.voluntary.map((entry) => ({ term: entry.name, count: entry.count })),
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ meta: { results: { total: SNAPSHOT.recallCount } } }), {
      status: 200,
    });
  }) as unknown as typeof globalThis.fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('foodRecallDateLabel', () => {
  it('spells a publication date out', () => {
    expect(foodRecallDateLabel('2012-06-20')).toBe('20 June 2012');
    expect(foodRecallDateLabel('2026-09-23')).toBe('23 September 2026');
  });

  it('stops on a date it cannot read', () => {
    expect(() => foodRecallDateLabel('last Wednesday')).toThrow(/Unreadable publication date/);
    expect(() => foodRecallDateLabel('2012-13-20')).toThrow(/Unreadable publication date/);
  });
});

describe('buildFoodRecallBars', () => {
  it('splits each year into Class I and everything else', () => {
    const bars = buildFoodRecallBars([
      { year: 2012, total: 1917, classOne: 1053, other: 864 },
      { year: 2026, total: 1007, classOne: 366, other: 641 },
    ]);
    expect(bars).toEqual([
      { year: 2012, label: '2012', classOne: 1053, other: 864, total: 1917 },
      { year: 2026, label: '2026', classOne: 366, other: 641, total: 1007 },
    ]);
  });

  it('stops on a file with no years', () => {
    expect(() => buildFoodRecallBars([])).toThrow(/No years to chart/);
  });
});

describe('buildFoodRecallStory', () => {
  it('reads the headline figures out of the counted file', () => {
    const story = buildFoodRecallStory(SUMMARY);
    expect(story.recallCount).toBe(29463);
    expect(story.classOneCount).toBe(12965);
    expect(story.classOneSharePercent).toBeCloseTo(44.0, 1);
    expect(story.firstReportDateLabel).toBe('20 June 2012');
    expect(story.newestReportDateLabel).toBe('23 September 2026');
    expect(story.firstYear).toBe(2012);
    expect(story.newestYear).toBe(2026);
    expect(story.newestYearCount).toBe(1007);
    expect(story.firstYearCount).toBe(1917);
    expect(story.busiestYear).toEqual({ year: 2017, total: 3203, classOne: 1151, other: 2052 });
    expect(story.voluntaryCount).toBe(29060);
    expect(story.mandatedCount).toBe(396);
    expect(story.voluntarySharePercent).toBeCloseTo(98.6, 1);
  });

  it('charts one bar per year in the file', () => {
    const story = buildFoodRecallStory(SUMMARY);
    expect(story.bars).toHaveLength(SUMMARY.years.length);
    expect(story.bars[0]?.year).toBe(2012);
    expect(story.bars[story.bars.length - 1]?.year).toBe(2026);
  });

  it('gives every classification a share of the file', () => {
    const story = buildFoodRecallStory(SUMMARY);
    const shares = story.classCounts.map((entry) => entry.sharePercent);
    expect(story.classCounts[0]?.name).toBe('Class II');
    expect(shares.reduce((total, share) => total + share, 0)).toBeCloseTo(100, 0);
  });

  it('stops on a summary with no years', () => {
    const years: OpenFdaFoodRecallYear[] = [];
    expect(() => buildFoodRecallStory({ ...SUMMARY, years })).toThrow(/No years to summarise/);
  });
});

describe('fetchFoodRecallStory', () => {
  it('reads the live endpoint and folds five responses into the story', async () => {
    vi.stubGlobal('fetch', fixtureFetch());
    const story = await fetchFoodRecallStory();
    expect(story.recallCount).toBe(29463);
    expect(story.classOneCount).toBe(12965);
    expect(story.newestYearCount).toBe(1007);
  });

  it('falls back to the committed snapshot when the endpoint fails', async () => {
    const warnings: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((message: unknown) => {
      warnings.push(String(message));
    });
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }));
    const story = await fetchFoodRecallStory();
    expect(story.recallCount).toBe(29463);
    expect(warnings[0]).toContain('Falling back to the committed openFDA food recall snapshot');
    vi.restoreAllMocks();
  });
});
