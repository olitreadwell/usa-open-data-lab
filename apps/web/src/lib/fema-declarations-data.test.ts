import {
  buildFemaDeclarationCatalogue,
  parseFemaDeclarationPayload,
} from '@usa-open-data-connectors/usa-sources';
import type { FemaDeclaration } from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildDecadeFireShare,
  buildFemaDeclarationBars,
  buildFemaDeclarationStory,
  countIncidentTypeInYear,
  femaMonthLabel,
  fetchFemaDeclarationStory,
  findBusiestMonth,
} from './fema-declarations-data';

const FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/fema-disaster-declarations-2026-09-29.json',
);
const RAW_FIXTURE = readFileSync(FIXTURE_PATH, 'utf8');
const CATALOGUE = buildFemaDeclarationCatalogue(
  parseFemaDeclarationPayload(JSON.parse(RAW_FIXTURE) as unknown),
);

/** One declaration with the fields the helpers read. */
function declaration(
  disasterNumber: number,
  declarationDate: string,
  incidentType: string,
  declarationType = 'Major Disaster',
): FemaDeclaration {
  return {
    disasterNumber,
    declarationDate,
    year: Number(declarationDate.slice(0, 4)),
    declarationType,
    incidentType,
    stateCode: 'CA',
    stateName: 'California',
  };
}

describe('femaMonthLabel', () => {
  it('shortens a declaration date to a month and a year', () => {
    expect(femaMonthLabel('2020-03-13T00:00:00.000Z')).toBe('Mar 2020');
    expect(femaMonthLabel('2026-09-15T00:00:00.000Z')).toBe('Sep 2026');
  });

  it('stops on a date it cannot read', () => {
    expect(() => femaMonthLabel('last spring')).toThrow(/Unreadable declaration date/);
  });
});

describe('buildFemaDeclarationBars', () => {
  it('splits each year into fire and every other hazard', () => {
    const bars = buildFemaDeclarationBars([
      { year: 1953, total: 6, fire: 1 },
      { year: 2020, total: 315, fire: 82 },
    ]);
    expect(bars).toEqual([
      { year: 1953, label: '1953', fire: 1, other: 5, total: 6 },
      { year: 2020, label: '2020', fire: 82, other: 233, total: 315 },
    ]);
  });

  it('stops when there are no years to chart', () => {
    expect(() => buildFemaDeclarationBars([])).toThrow(/No years to chart/);
  });
});

describe('findBusiestMonth', () => {
  it('names the month with the most declarations', () => {
    const declarations = [
      declaration(1, '2020-03-01T00:00:00.000Z', 'Biological'),
      declaration(2, '2020-03-13T00:00:00.000Z', 'Biological'),
      declaration(3, '2020-09-01T00:00:00.000Z', 'Fire'),
    ];
    expect(findBusiestMonth(declarations)).toEqual({ label: 'Mar 2020', count: 2 });
  });

  it('stops when there is nothing to count', () => {
    expect(() => findBusiestMonth([])).toThrow(/No declarations to count months from/);
  });
});

describe('countIncidentTypeInYear', () => {
  it('counts one hazard inside one year', () => {
    const declarations = [
      declaration(1, '2020-03-01T00:00:00.000Z', 'Biological'),
      declaration(2, '2020-04-01T00:00:00.000Z', 'Biological'),
      declaration(3, '2021-01-01T00:00:00.000Z', 'Biological'),
      declaration(4, '2020-05-01T00:00:00.000Z', 'Fire'),
    ];
    expect(countIncidentTypeInYear(declarations, 'Biological', 2020)).toBe(2);
  });
});

describe('buildDecadeFireShare', () => {
  it('counts each decade and the fire share inside it', () => {
    const declarations = [
      declaration(1, '1996-03-01T00:00:00.000Z', 'Fire'),
      declaration(2, '1988-01-01T00:00:00.000Z', 'Flood'),
      declaration(3, '2020-01-01T00:00:00.000Z', 'Biological'),
    ];
    expect(buildDecadeFireShare(declarations)).toEqual([
      { decade: 1980, total: 1, fire: 0 },
      { decade: 1990, total: 1, fire: 1 },
      { decade: 2020, total: 1, fire: 0 },
    ]);
  });
});

describe('buildFemaDeclarationStory', () => {
  it('reads the headline figures out of the file', () => {
    const story = buildFemaDeclarationStory(CATALOGUE);
    expect(story.declarationCount).toBe(5272);
    expect(story.firstYear).toBe(1953);
    expect(story.newestYear).toBe(2026);
    expect(story.fireCount).toBe(1785);
    expect(story.fireSharePercent).toBeCloseTo(33.86, 1);
    expect(story.busiestYear).toEqual({ year: 2020, total: 315, fire: 82 });
    expect(story.busiestMonthLabel).toBe('Mar 2020');
    expect(story.busiestMonthCount).toBe(142);
    expect(story.covidCount).toBe(165);
    expect(story.fireManagementCount).toBe(1213);
    expect(story.fireManagementFirstYear).toBe(2002);
  });

  it('names the two states with the most declarations', () => {
    const story = buildFemaDeclarationStory(CATALOGUE);
    expect(story.topStates).toEqual([
      { stateCode: 'CA', stateName: 'California', count: 397 },
      { stateCode: 'TX', stateName: 'Texas', count: 392 },
    ]);
  });

  it('charts every year in the file, oldest first', () => {
    const story = buildFemaDeclarationStory(CATALOGUE);
    expect(story.bars[0]?.year).toBe(1953);
    expect(story.bars[story.bars.length - 1]?.year).toBe(2026);
    expect(story.bars.length).toBe(story.newestYear - story.firstYear + 1);
    expect(story.newestYearCount).toBe(story.bars[story.bars.length - 1]?.total);
  });

  it('rises from almost no fire declarations to around two fifths', () => {
    const story = buildFemaDeclarationStory(CATALOGUE);
    const first = story.decadeFireShare[0];
    const twoThousands = story.decadeFireShare.find((entry) => entry.decade === 2000);
    if (first === undefined || twoThousands === undefined) {
      throw new Error('Expected the 1950s and the 2000s in the decade counts');
    }
    expect(first.fire).toBe(2);
    expect(twoThousands.fire).toBe(574);
  });
});

describe('fetchFemaDeclarationStory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads the live file in one request', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(url);
        return new Response(RAW_FIXTURE, { status: 200 });
      }),
    );
    const story = await fetchFemaDeclarationStory();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('www.fema.gov');
    expect(seen[0]).toContain('FemaWebDisasterDeclarations');
    expect(story.declarationCount).toBe(5272);
  });

  it('falls back to the committed snapshot when the fetch rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const story = await fetchFemaDeclarationStory();
    expect(story.declarationCount).toBe(5272);
    expect(story.fireCount).toBe(1785);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('FEMA declaration snapshot'));
  });

  it('falls back on a non-200 reply', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    const story = await fetchFemaDeclarationStory();
    expect(story.busiestYear.year).toBe(2020);
  });
});
