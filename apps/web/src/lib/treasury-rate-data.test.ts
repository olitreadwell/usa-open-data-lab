import {
  buildTreasuryAvgInterestRateSeries,
  parseTreasuryAvgInterestRatePayload,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildTreasuryRateStory,
  fetchTreasuryRateStory,
  treasuryMonthLabel,
  type TreasuryRatePoint,
  treasuryRateUrl,
} from './treasury-rate-data';
import { formatPercentTwoDecimals, formatPointChange } from './us-format';

const FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/treasury-avg-interest-rate-2026-09-28.json',
);
const RAW_FIXTURE = readFileSync(FIXTURE_PATH, 'utf8');
const SERIES = buildTreasuryAvgInterestRateSeries(
  parseTreasuryAvgInterestRatePayload(JSON.parse(RAW_FIXTURE) as unknown),
);
const STORY = buildTreasuryRateStory(SERIES);

/** The point for one month label in the story, or a failure if it is missing. */
function pointAtLabel(label: string): TreasuryRatePoint {
  const point = STORY.points.find((candidate) => candidate.label === label);
  if (point === undefined) {
    throw new Error(`No ${label} in the rate file`);
  }
  return point;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('treasuryMonthLabel', () => {
  it('names the month and the year, e.g. "Aug 2026"', () => {
    expect(treasuryMonthLabel({ year: 2026, month: 8 })).toBe('Aug 2026');
    expect(treasuryMonthLabel({ year: 2001, month: 1 })).toBe('Jan 2001');
    expect(treasuryMonthLabel({ year: 2025, month: 12 })).toBe('Dec 2025');
  });
});

describe('buildTreasuryRateStory', () => {
  it('reads every month in the run, oldest first', () => {
    expect(STORY.monthCount).toBe(308);
    expect(STORY.first.label).toBe('Jan 2001');
    expect(STORY.latest.label).toBe('Aug 2026');
    const labels = STORY.points.map((point) => point.label);
    expect(labels[0]).toBe('Jan 2001');
    expect(labels[labels.length - 1]).toBe('Aug 2026');
  });

  it('picks out the highest and lowest months in the file', () => {
    expect(STORY.highest.label).toBe('Jan 2001');
    expect(STORY.highest.ratePercent).toBeCloseTo(6.594, 3);
    expect(STORY.lowest.label).toBe('Jan 2022');
    expect(STORY.lowest.ratePercent).toBeCloseTo(1.556, 3);
  });

  it('measures the climb out of the low', () => {
    expect(STORY.latest.ratePercent).toBeCloseTo(3.49, 3);
    expect(STORY.changeSinceLow).toBeCloseTo(1.934, 3);
    expect(formatPointChange(STORY.changeSinceLow)).toBe('+1.9 pts');
  });

  it('finds the last month at or above the newest rate', () => {
    expect(STORY.highestSince?.label).toBe('May 2009');
    expect(STORY.highestSince?.ratePercent).toBeCloseTo(3.524, 3);
  });

  it('counts the months below two percent and brackets them', () => {
    expect(STORY.belowRateCount).toBe(28);
    expect(STORY.belowRateFirst?.label).toBe('May 2020');
    expect(STORY.belowRateLast?.label).toBe('Aug 2022');
  });

  it('averages the first ten years against the last ten', () => {
    expect(STORY.firstDecadeMean).toBeCloseTo(4.656, 3);
    expect(STORY.recentDecadeMean).toBeCloseTo(2.51, 2);
  });

  it('quotes the two ends in the percent format the cards use', () => {
    expect(formatPercentTwoDecimals(STORY.highest.ratePercent)).toBe('6.59%');
    expect(formatPercentTwoDecimals(STORY.lowest.ratePercent)).toBe('1.56%');
    expect(formatPercentTwoDecimals(pointAtLabel('Aug 2026').ratePercent)).toBe('3.49%');
  });
});

describe('treasuryRateUrl', () => {
  it('asks the fiscal data API for the portfolio total', () => {
    const url = treasuryRateUrl();
    expect(url).toContain('api.fiscaldata.treasury.gov');
    expect(url).toContain('avg_interest_rates');
    expect(new URL(url).searchParams.get('filter')).toBe(
      'security_type_desc:eq:Interest-bearing Debt',
    );
  });
});

describe('fetchTreasuryRateStory', () => {
  it('reads the file and builds the story', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(url);
        return new Response(RAW_FIXTURE, { status: 200 });
      }),
    );
    const story = await fetchTreasuryRateStory();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('avg_interest_rates');
    expect(story.monthCount).toBe(308);
    expect(story.lowest.label).toBe('Jan 2022');
  });

  it('falls back to the committed snapshot when the fetch rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const story = await fetchTreasuryRateStory();
    expect(story.monthCount).toBe(308);
    expect(story.latest.label).toBe('Aug 2026');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Treasury rate snapshot'));
  });

  it('falls back on a non-200 reply', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })));
    const story = await fetchTreasuryRateStory();
    expect(story.highest.ratePercent).toBeCloseTo(6.594, 3);
  });
});
