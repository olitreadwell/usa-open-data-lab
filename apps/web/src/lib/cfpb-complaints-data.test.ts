import { parseCfpComplaintSnapshot } from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildCfpComplaintBars,
  buildCfpConsumerComplaintStory,
  cfpbComplaintDateLabel,
  fetchCfpConsumerComplaintStory,
} from './cfpb-complaints-data';

const FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/cfpb-consumer-complaints-2026-10-03.json',
);
const SNAPSHOT = parseCfpComplaintSnapshot(
  JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as unknown,
);

/** The year the live fetch treats as the newest, so the test survives a new year. */
const CURRENT_YEAR = new Date().getFullYear();

/** A totals-only body in the shape the search API sends. */
function totalPayload(value: number): Record<string, unknown> {
  return { hits: { total: { value, relation: 'eq' }, hits: [] } };
}

/**
 * Answers the three request shapes the adapter makes: one year of totals, one
 * day of totals, and the product and company tallies.
 */
function fixtureFetch(): typeof globalThis.fetch {
  return (async (input: string | URL) => {
    const url = new URL(String(input));
    if (!url.searchParams.has('no_aggs')) {
      return new Response(
        JSON.stringify({
          aggregations: {
            product: { product: { buckets: [{ key: 'Credit reporting', doc_count: 12555681 }] } },
            company: {
              company: {
                buckets: [
                  { key: 'TRANSUNION INTERMEDIATE HOLDINGS, INC.', doc_count: 5015681 },
                  { key: 'EQUIFAX, INC.', doc_count: 4815296 },
                  { key: 'Experian Information Solutions Inc.', doc_count: 4396123 },
                ],
              },
            },
          },
        }),
        { status: 200 },
      );
    }
    const min = url.searchParams.get('date_received_min') ?? '';
    const max = url.searchParams.get('date_received_max') ?? '';
    if (min === max) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return new Response(JSON.stringify(totalPayload(min === yesterday ? 443 : 0)), {
        status: 200,
      });
    }
    const counts: Record<string, number> = { '2025': 5442963, '2026': 5462631 };
    return new Response(JSON.stringify(totalPayload(counts[min.slice(0, 4)] ?? 0)), {
      status: 200,
    });
  }) as unknown as typeof globalThis.fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cfpbComplaintDateLabel', () => {
  it('spells a complaint date out', () => {
    expect(cfpbComplaintDateLabel('2026-10-02')).toBe('2 October 2026');
    expect(cfpbComplaintDateLabel('2011-12-01')).toBe('1 December 2011');
  });

  it('stops on a date it cannot read', () => {
    expect(() => cfpbComplaintDateLabel('last Tuesday')).toThrow(/Unreadable complaint date/);
    expect(() => cfpbComplaintDateLabel('2026-13-01')).toThrow(/Unreadable complaint date/);
  });
});

describe('buildCfpComplaintBars', () => {
  it('marks the newest year as partial and the years before it as complete', () => {
    const bars = buildCfpComplaintBars({
      ...SNAPSHOT,
      years: [
        { year: 2025, complaintCount: 5442963 },
        { year: 2026, complaintCount: 5462631 },
      ],
    });
    expect(bars).toEqual([
      { year: 2025, label: '2025', complaintCount: 5442963, partial: false },
      { year: 2026, label: '2026', complaintCount: 5462631, partial: true },
    ]);
  });

  it('stops on a file with no years', () => {
    expect(() => buildCfpComplaintBars({ ...SNAPSHOT, years: [] })).toThrow(/No years to chart/);
  });
});

describe('buildCfpConsumerComplaintStory', () => {
  const story = buildCfpConsumerComplaintStory(SNAPSHOT);

  it('reads the headline figures out of the counted file', () => {
    expect(story.totalComplaints).toBe(18145013);
    expect(story.firstYear).toBe(2011);
    expect(story.newestYear).toBe(2026);
    expect(story.newestYearCount).toBe(5462631);
    expect(story.newestReceivedDateLabel).toBe('2 October 2026');
    expect(story.busiestCompleteYear).toEqual({ year: 2025, complaintCount: 5442963 });
  });

  it('charts one bar per year in the file, with the newest one partial', () => {
    expect(story.bars).toHaveLength(SNAPSHOT.years.length);
    expect(story.bars[0]?.year).toBe(2011);
    expect(story.bars[story.bars.length - 1]?.partial).toBe(true);
  });

  it('adds up the three companies named most often', () => {
    expect(story.topCompanyName).toBe('TRANSUNION INTERMEDIATE HOLDINGS, INC.');
    expect(story.topCompanyCount).toBe(5015681);
    expect(story.topThreeCount).toBe(14227100);
    expect(story.topThreeSharePercent).toBeCloseTo(78.4, 1);
  });
});

describe('fetchCfpConsumerComplaintStory', () => {
  it('reads the live file and folds it into the story', async () => {
    vi.stubGlobal('fetch', fixtureFetch());
    const story = await fetchCfpConsumerComplaintStory();
    expect(story.totalComplaints).toBe(10905594);
    expect(story.bars).toHaveLength(CURRENT_YEAR - 2011 + 1);
    expect(story.topCompanyCount).toBe(5015681);
    expect(story.newestYearCount).toBe(5462631);
  });

  it('falls back to the committed snapshot when the API fails', async () => {
    const warnings: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((message: unknown) => {
      warnings.push(String(message));
    });
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }));
    const story = await fetchCfpConsumerComplaintStory();
    expect(story.totalComplaints).toBe(18145013);
    expect(warnings[0]).toContain('Falling back to the committed CFPB complaint snapshot');
    vi.restoreAllMocks();
  });
});
