import { parseCpscRecallSnapshot } from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildCpscProductRecallStory,
  buildCpscRecallBars,
  cpscRecallDateLabel,
  fetchCpscProductRecallStory,
} from './cpsc-recall-data';

const FIXTURE_PATH = path.join(process.cwd(), 'src/fixtures/cpsc-product-recalls-2026-10-02.json');
const SNAPSHOT = parseCpscRecallSnapshot(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as unknown);

/** The year the live fetch treats as the newest, so the test survives a new year. */
const CURRENT_YEAR = new Date().getFullYear();

/** One recall row in the shape the service sends. */
function recallRow(recallNumber: string, recallDate: string): Record<string, unknown> {
  return {
    RecallID: Number(recallNumber),
    RecallNumber: recallNumber,
    RecallDate: `${recallDate}T00:00:00`,
    Title: `Recall ${recallNumber}`,
    Products: [{ Name: 'A product' }],
    RemedyOptions: [{ Option: 'Refund' }],
    ManufacturerCountries: [{ Country: 'China' }],
  };
}

// Two recalls in 2014 and one in the current year, so the fetched file is
// small but still has a complete year and a year that is still being filled.
function fetchedRowsFor(year: number): Record<string, unknown>[] {
  if (year === 2014) {
    return [recallRow('1', '2014-04-01'), recallRow('2', '2014-08-01')];
  }
  if (year === CURRENT_YEAR) {
    return [recallRow('3', `${String(CURRENT_YEAR)}-02-01`)];
  }
  return [];
}

/** Answers each per-year request with the rows dated inside that year. */
function fixtureFetch(): typeof globalThis.fetch {
  return (async (input: string | URL) => {
    const year = Number(
      new URL(String(input)).searchParams.get('RecallDateStart')?.slice(0, 4) ?? '0',
    );
    return new Response(JSON.stringify(fetchedRowsFor(year)), { status: 200 });
  }) as unknown as typeof globalThis.fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cpscRecallDateLabel', () => {
  it('spells a recall date out', () => {
    expect(cpscRecallDateLabel('2026-09-24')).toBe('24 September 2026');
    expect(cpscRecallDateLabel('2014-01-02')).toBe('2 January 2014');
  });

  it('stops on a date it cannot read', () => {
    expect(() => cpscRecallDateLabel('last Thursday')).toThrow(/Unreadable recall date/);
    expect(() => cpscRecallDateLabel('2026-13-01')).toThrow(/Unreadable recall date/);
  });
});

describe('buildCpscRecallBars', () => {
  it('marks the newest year as partial and the years before it as complete', () => {
    const bars = buildCpscRecallBars({
      ...SNAPSHOT,
      years: [
        { year: 2024, recallCount: 305 },
        { year: 2026, recallCount: 459 },
      ],
    });
    expect(bars).toEqual([
      { year: 2024, label: '2024', recallCount: 305, partial: false },
      { year: 2026, label: '2026', recallCount: 459, partial: true },
    ]);
  });

  it('stops on a file with no years', () => {
    expect(() => buildCpscRecallBars({ ...SNAPSHOT, years: [] })).toThrow(/No years to chart/);
  });
});

describe('buildCpscProductRecallStory', () => {
  const story = buildCpscProductRecallStory(SNAPSHOT);

  it('reads the headline figures out of the counted file', () => {
    expect(story.totalRecalls).toBe(3986);
    expect(story.firstYear).toBe(2014);
    expect(story.newestYear).toBe(2026);
    expect(story.newestYearCount).toBe(459);
    expect(story.newestRecallDateLabel).toBe('24 September 2026');
    expect(story.busiestCompleteYear).toEqual({ year: 2025, recallCount: 420 });
    expect(story.quietestCompleteYear).toEqual({ year: 2021, recallCount: 219 });
  });

  it('charts one bar per year in the file, with the newest one partial', () => {
    expect(story.bars).toHaveLength(SNAPSHOT.years.length);
    expect(story.bars[0]?.year).toBe(2014);
    expect(story.bars[story.bars.length - 1]?.partial).toBe(true);
  });

  it('names the remedy counts and their share of the file', () => {
    expect(story.refundCount).toBe(1980);
    expect(story.repairCount).toBe(1289);
    expect(story.remedies[0]?.option).toBe('Refund');
    expect(story.remedies[0]?.sharePercent).toBeCloseTo(49.7, 1);
  });

  it('names China as the country on the most recalls', () => {
    expect(story.topCountryCount).toBe(2312);
    expect(story.topCountrySharePercent).toBeCloseTo(58.0, 1);
    expect(story.countryCount).toBe(122);
  });
});

describe('fetchCpscProductRecallStory', () => {
  it('reads one response per year and folds them into the story', async () => {
    vi.stubGlobal('fetch', fixtureFetch());
    const story = await fetchCpscProductRecallStory();
    expect(story.totalRecalls).toBe(3);
    expect(story.bars).toHaveLength(CURRENT_YEAR - 2014 + 1);
    expect(story.newestYearCount).toBe(1);
    expect(story.busiestCompleteYear).toEqual({ year: 2014, recallCount: 2 });
  });

  it('falls back to the committed snapshot when the service fails', async () => {
    const warnings: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((message: unknown) => {
      warnings.push(String(message));
    });
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }));
    const story = await fetchCpscProductRecallStory();
    expect(story.totalRecalls).toBe(3986);
    expect(warnings[0]).toContain('Falling back to the committed CPSC recall snapshot');
    vi.restoreAllMocks();
  });
});
