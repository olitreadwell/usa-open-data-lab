# usa-open-data-lab

Example site for
[usa-open-data-connectors](https://github.com/olitreadwell/usa-open-data-connectors).
Five microsites showing the full pipeline from a US public-data connector to
a deployed static chart.

## The microsites

- **The jobless rate**: the national unemployment rate, month by month over
  the last twenty years. It peaked at 14.8 percent in April 2020 and fell to 3.4
  percent by April 2023. October 2025 is missing, because the agency could
  not publish it during the 2025 lapse in appropriations. Data from the
  Bureau of Labor Statistics public data API, fetched at deploy time.
- **Hawaii earthquakes**: 264 earthquakes at magnitude 2.5 or higher around
  the Hawaiian islands in 2025. Two thirds of them stayed below magnitude 3,
  the strongest was an M4.41 on 15 March, and the deepest was 59.8 km down.
  Data from the USGS earthquake catalogue, read at deploy time.
- **US temperature record**: the contiguous United States has averaged 52.01
  °F across the 20th century, and every year from 2000 to 2025 came in above
  that line. The warmest year in the record is 2024 at 55.48 °F and the
  coldest is 1917 at 50.05 °F. Data from the NOAA NCEI Climate at a Glance
  download, read at deploy time.
- **County obesity**: 2,956 US counties with an estimated share of adults
  living with obesity, from 16.7 percent in Boulder County, Colorado to 52.9
  percent in Perry County, Alabama. The median county sits at 37.9 percent,
  above the release's own national figure of 32.8 percent. Data from the CDC
  PLACES county release, read at deploy time.
- **Battery sea level**: the tide gauge at The Battery in New York has 155
  years of annual means, from 1856 to 2025, and the mean has climbed 0.48 m
  (19 inches) across them at a fitted 2.95 mm a year. The ten highest years
  all fall between 2010 and 2025. Data from the NOAA CO-OPS monthly mean sea
  level product, read at deploy time.

## What this example shows

- `apps/web/src/lib/jobless-data.ts` calls `parseBlsObservations` from
  `@usa-open-data-connectors/usa-sources` to read series `LNS14000000`, in two requests because
  the API caps one request at ten years.
- `apps/web/src/lib/hawaii-quakes-data.ts` calls `parseUsgsEarthquakes` for one
  closed year, drops the non-tectonic rows the catalogue mixes in, and counts
  what is left into half-magnitude bands.
- `apps/web/src/lib/us-temperature-data.ts` calls
  `parseNceiAnnualTemperatureCsv` for the calendar-year record, measures every
  year against the 20th century average in the same file, and stacks the years
  into decade rows for the strip chart.
- `apps/web/src/lib/cdc-obesity-data.ts` calls `parseCdcCountyObesityPayload`
  for the whole PLACES release, keeps the release's own national row apart
  from the counties, and counts the counties into two-point bands.
- `apps/web/src/lib/sea-level-data.ts` calls `parseNoaaSeaLevelPayload` for
  one gauge's whole record, averages the months into calendar years, fits a
  trend through them, and stops the window at the last complete year.
- The build falls back to a committed snapshot when the API is rate limited
  or blocked, so the static export always succeeds.
- `JoblessChart` renders the monthly line with Recharts and breaks the line
  at the month that was never published; the page and chart have unit tests,
  and the e2e suite asserts a plausible live rate and the pandemic peak.

## Connectors wiring

The site uses one package from the connectors repo, `@usa-open-data-connectors/usa-sources`,
vendored under `packages/usa-sources`. npm git dependencies cannot target a
subpackage inside a workspace monorepo, so the package is copied here and kept
in sync with a script:

```bash
node scripts/sync-connectors.mjs                     # uses ../usa-open-data-connectors
node scripts/sync-connectors.mjs --from /path/to/repo
```

The script renames whatever scope the connectors package ships under to
`@usa-open-data-lab`, strips the `.js` extension from relative imports, and points the
package entry at `src/`. All three happen in the script rather than by hand, so
a sync is reproducible.

Edit `packages/usa-sources` only by syncing from the connectors repo.

## Stack

- Next.js 16, React 19.2, TypeScript
- Tailwind CSS 4 + SCSS hybrid, shadcn/ui (Base UI primitives)
- Vitest + Testing Library + jest-axe (unit/a11y), Playwright + `@axe-core/playwright`
- Monorepo: Turborepo, npm workspaces

## Quick start

```bash
npm install
npm run dev
```

## Checks

```bash
npm run type-check
npm test
npm run lint
npm run build
```

Playwright serves the built `out/` directory on port 3000. Set `E2E_PORT` to run
the suite beside another dev server.
