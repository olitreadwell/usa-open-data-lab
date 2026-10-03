import {
  buildFemaDeclarationCatalogue,
  buildFemaDeclarationUrl,
  parseFemaDeclarationPayload,
  UsSourceError,
} from '@usa-open-data-connectors/usa-sources';
import type {
  FemaDeclaration,
  FemaDeclarationCatalogue,
  FemaDeclarationYear,
} from '@usa-open-data-connectors/usa-sources';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// The OpenFEMA web disaster declarations file. Keyless, public domain, one
// row per declaration the agency has published since 1953.
export const FEMA_DECLARATION_URL = buildFemaDeclarationUrl();

/**
 * Incident type the file uses for COVID-19.
 *
 * The 2020 spike in the file is the pandemic rather than a run of storms:
 * the agency files each state's major disaster declaration under a
 * biological incident.
 */
export const COVID_INCIDENT_TYPE = 'Biological';

/** Year the pandemic spike lands in, and the one the copy names. */
export const COVID_YEAR = 2020;

/** Declaration program the agency uses for fires on federal land. */
export const FIRE_MANAGEMENT_PROGRAM = 'Fire Management';

export const LIVE_PROBE_TIMEOUT_MS = 60_000;

// Committed snapshot, so the static build still works when the FEMA host is
// slow or unreachable from the build runner.
const FEMA_DECLARATION_FIXTURE_PATH = path.join(
  process.cwd(),
  'src/fixtures/fema-disaster-declarations-2026-09-29.json',
);

/**
 * Month abbreviations, indexed from January.
 *
 * Spelled out here rather than read from the runtime's locale, so a label
 * cannot change with the build runner's settings.
 */
const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** One bar on the chart: a calendar year, split into fire and the rest. */
export interface FemaDeclarationBar {
  year: number;
  /** Axis label, e.g. "2020". */
  label: string;
  /** Declarations in that year for a fire of any kind. */
  fire: number;
  /** Declarations in that year for every other hazard. */
  other: number;
  /** Every declaration in that year. */
  total: number;
}

/** One state's share of the file, for the copy that names the leaders. */
export interface FemaStateLeader {
  stateCode: string;
  stateName: string;
  count: number;
}

/** The story's numbers, all read from the declaration file at deploy time. */
export interface FemaDeclarationStory {
  bars: FemaDeclarationBar[];
  declarationCount: number;
  firstYear: number;
  newestYear: number;
  /** Declarations dated to the newest year, which is still open. */
  newestYearCount: number;
  fireCount: number;
  /** Fire declarations as a share of the whole file, in percent. */
  fireSharePercent: number;
  busiestYear: FemaDeclarationYear;
  /** The single busiest month in the file, e.g. "Mar 2020". */
  busiestMonthLabel: string;
  busiestMonthCount: number;
  /** Declarations the agency filed under a biological incident in 2020. */
  covidCount: number;
  fireManagementCount: number;
  fireManagementFirstYear: number;
  topStates: FemaStateLeader[];
  /** Fire share of the declarations in each decade, oldest first. */
  decadeFireShare: { decade: number; total: number; fire: number }[];
}

/** Short label for a declaration date, e.g. "Mar 2020". */
export function femaMonthLabel(declarationDate: string): string {
  const [year, month] = declarationDate.split('-');
  const abbreviation = MONTH_ABBREVIATIONS[Number(month) - 1];
  if (year === undefined || abbreviation === undefined) {
    throw new UsSourceError(`Unreadable declaration date: ${declarationDate}`);
  }
  return `${abbreviation} ${year}`;
}

/**
 * Splits every year in the file into fire declarations and the rest.
 *
 * The newest year is a partial year, so its bar fills as the agency publishes
 * more declarations. The caller reads `newestYearCount` when it needs that
 * count on its own.
 *
 * @param years - the per-year counts from the catalogue
 * @returns one bar per year, oldest first
 */
export function buildFemaDeclarationBars(years: FemaDeclarationYear[]): FemaDeclarationBar[] {
  if (years.length === 0) {
    throw new UsSourceError('No years to chart');
  }
  return years.map((year) => ({
    year: year.year,
    label: String(year.year),
    fire: year.fire,
    other: year.total - year.fire,
    total: year.total,
  }));
}

/**
 * Finds the busiest month in the file.
 *
 * @param declarations - every declaration, in any order
 * @returns the month label and how many declarations it holds
 */
export function findBusiestMonth(declarations: FemaDeclaration[]): {
  label: string;
  count: number;
} {
  if (declarations.length === 0) {
    throw new UsSourceError('No declarations to count months from');
  }
  const counts = new Map<string, number>();
  for (const declaration of declarations) {
    const key = declaration.declarationDate.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let busiestKey = '';
  let busiestCount = 0;
  for (const [key, count] of counts) {
    if (count > busiestCount) {
      busiestKey = key;
      busiestCount = count;
    }
  }
  const first = declarations[0];
  if (first === undefined) {
    throw new UsSourceError('No declarations to count months from');
  }
  return { label: femaMonthLabel(`${busiestKey}-01`), count: busiestCount };
}

/** How many declarations in one year carry a given incident type. */
export function countIncidentTypeInYear(
  declarations: FemaDeclaration[],
  incidentType: string,
  year: number,
): number {
  return declarations.filter(
    (declaration) => declaration.incidentType === incidentType && declaration.year === year,
  ).length;
}

/**
 * Counts the file by decade and works out fire's share of each one.
 *
 * @param declarations - every declaration, in any order
 * @returns one entry per decade in the file, oldest first
 */
export function buildDecadeFireShare(
  declarations: FemaDeclaration[],
): { decade: number; total: number; fire: number }[] {
  const decades = new Map<number, { decade: number; total: number; fire: number }>();
  for (const declaration of declarations) {
    const decade = Math.floor(declaration.year / 10) * 10;
    const entry = decades.get(decade) ?? { decade, total: 0, fire: 0 };
    entry.total += 1;
    if (declaration.incidentType === 'Fire') {
      entry.fire += 1;
    }
    decades.set(decade, entry);
  }
  return [...decades.values()].sort((left, right) => left.decade - right.decade);
}

/**
 * Turns the declaration file into the bars and figures the story renders.
 *
 * @param catalogue - the parsed and counted declaration file
 * @returns the chart bars plus the figures the copy quotes
 */
export function buildFemaDeclarationStory(
  catalogue: FemaDeclarationCatalogue,
): FemaDeclarationStory {
  const declarations = catalogue.declarations;
  const newestYear = catalogue.newestYear;
  const busiestMonth = findBusiestMonth(declarations);
  const fireManagement = declarations.filter(
    (declaration) => declaration.declarationType === FIRE_MANAGEMENT_PROGRAM,
  );

  return {
    bars: buildFemaDeclarationBars(catalogue.years),
    declarationCount: catalogue.declarationCount,
    firstYear: catalogue.firstYear,
    newestYear,
    newestYearCount: declarations.filter((declaration) => declaration.year === newestYear).length,
    fireCount: catalogue.fireCount,
    fireSharePercent: (catalogue.fireCount / catalogue.declarationCount) * 100,
    busiestYear: catalogue.busiestYear,
    busiestMonthLabel: busiestMonth.label,
    busiestMonthCount: busiestMonth.count,
    covidCount: countIncidentTypeInYear(declarations, COVID_INCIDENT_TYPE, COVID_YEAR),
    fireManagementCount: fireManagement.length,
    fireManagementFirstYear: fireManagement[0]?.year ?? catalogue.firstYear,
    topStates: catalogue.topStates.slice(0, 2).map((entry) => {
      const named = declarations.find((declaration) => declaration.stateCode === entry.name);
      return {
        stateCode: entry.name,
        stateName: named?.stateName ?? entry.name,
        count: entry.count,
      };
    }),
    decadeFireShare: buildDecadeFireShare(declarations),
  };
}

/**
 * Reads the FEMA declaration file at build time.
 *
 * Falls back to the committed snapshot when the endpoint is slow or
 * unreachable. The fallback is logged, not swallowed.
 *
 * @returns the chart bars and the figures the story renders
 */
export async function fetchFemaDeclarationStory(): Promise<FemaDeclarationStory> {
  try {
    const response = await globalThis.fetch(FEMA_DECLARATION_URL, {
      signal: AbortSignal.timeout(LIVE_PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${FEMA_DECLARATION_URL}`);
    }
    return buildFemaDeclarationStory(
      buildFemaDeclarationCatalogue(parseFemaDeclarationPayload(await response.json())),
    );
  } catch (error) {
    console.warn(
      `Falling back to the committed FEMA declaration snapshot: ${error instanceof Error ? error.message : String(error)}`,
    );
    const snapshot = JSON.parse(readFileSync(FEMA_DECLARATION_FIXTURE_PATH, 'utf8')) as unknown;
    return buildFemaDeclarationStory(
      buildFemaDeclarationCatalogue(parseFemaDeclarationPayload(snapshot)),
    );
  }
}
