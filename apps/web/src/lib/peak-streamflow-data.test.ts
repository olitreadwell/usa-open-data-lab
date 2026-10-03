import {
  buildUsgsPeakStreamflowSeries,
  parseUsgsPeakStreamflowPayload,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BIG_PEAK_CUBIC_FEET_PER_SECOND,
  buildPeakStreamflowBar,
  buildPeakStreamflowStory,
  fetchPeakStreamflowStory,
  peakDateLabel,
} from './peak-streamflow-data';

const FIXTURE_PATH = path.join(process.cwd(), 'src/fixtures/usgs-peak-streamflow-2026-10-01.json');
const RAW_FIXTURE = readFileSync(FIXTURE_PATH, 'utf8');
const SERIES = buildUsgsPeakStreamflowSeries(
  parseUsgsPeakStreamflowPayload(JSON.parse(RAW_FIXTURE) as unknown),
);
const STORY = buildPeakStreamflowStory(SERIES);

describe('peakDateLabel', () => {
  it('writes a peak date out in full', () => {
    expect(peakDateLabel('1993-08-01')).toBe('1 August 1993');
    expect(peakDateLabel('1844-06-27')).toBe('27 June 1844');
  });

  it('stops on a date it cannot read', () => {
    expect(() => peakDateLabel('the spring flood')).toThrow(/Unreadable peak date/);
  });
});

describe('buildPeakStreamflowBar', () => {
  it('carries the value in cubic feet per second', () => {
    const bar = buildPeakStreamflowBar({
      waterYear: 1993,
      calendarYear: 1993,
      peakDate: '1993-08-01',
      peakDischargeCubicFeetPerSecond: 1_080_000,
      qualifiers: ['UNKNOWNREGULATION'],
    });
    expect(bar.label).toBe('1993');
    expect(bar.peakDateLabel).toBe('1 August 1993');
    expect(bar.dischargeCubicFeetPerSecond).toBe(1_080_000);
  });
});

describe('buildPeakStreamflowStory', () => {
  it('names the record, the runner-up, and the lowest peak', () => {
    expect(STORY.record.waterYear).toBe(1993);
    expect(STORY.record.dischargeCubicFeetPerSecond).toBe(1_080_000);
    expect(STORY.runnerUp.waterYear).toBe(1903);
    expect(STORY.runnerUp.dischargeCubicFeetPerSecond).toBe(1_020_000);
    expect(STORY.lowest.waterYear).toBe(1934);
    expect(STORY.lowest.dischargeCubicFeetPerSecond).toBe(136_000);
  });

  it('covers 165 water years from 1844 to 2025', () => {
    expect(STORY.yearCount).toBe(165);
    expect(STORY.bars).toHaveLength(165);
    expect(STORY.firstWaterYear).toBe(1844);
    expect(STORY.lastWaterYear).toBe(2025);
    expect(STORY.latest.waterYear).toBe(2025);
  });

  it('lists the 17 water years from 1845 to 1861 with no row', () => {
    expect(STORY.missingYearCount).toBe(17);
    expect(STORY.missingWaterYears[0]).toBe(1845);
    expect(STORY.missingWaterYears[16]).toBe(1861);
  });

  it('counts the water years that reached the big-peak threshold', () => {
    expect(STORY.bigPeakYears).toEqual([1844, 1892, 1903, 1993, 2019]);
    expect(BIG_PEAK_CUBIC_FEET_PER_SECOND).toBe(900_000);
  });

  it('carries the middle year of the record', () => {
    expect(STORY.medianDischargeCubicFeetPerSecond).toBe(511_000);
  });

  it('stops when there is no second year to name', () => {
    expect(() =>
      buildPeakStreamflowStory(
        buildUsgsPeakStreamflowSeries(
          parseUsgsPeakStreamflowPayload({
            features: [
              {
                properties: {
                  monitoring_location_id: 'USGS-07010000',
                  parameter_code: '00060',
                  value: '1000',
                  time: '1993-08-01',
                  water_year: 1993,
                },
              },
            ],
          }),
        ),
      ),
    ).toThrow(/No second year/);
  });
});

describe('fetchPeakStreamflowStory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the live response when the request answers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(RAW_FIXTURE, { status: 200 }));
    const story = await fetchPeakStreamflowStory();
    expect(story.record.waterYear).toBe(1993);
    expect(story.yearCount).toBe(165);
  });

  it('falls back to the committed snapshot when the request fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 503 }));
    const story = await fetchPeakStreamflowStory();
    expect(story.record.waterYear).toBe(1993);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('committed peak-streamflow snapshot'),
    );
  });
});
