# Index

A map of this repo for anyone (or any agent) arriving cold.

## The site

`usa-open-data-lab` is a static Next.js export of small experiments on US public
data. One microsite is published at a time, listed in
`apps/web/src/lib/published-microsites.ts`. The home page is
(`apps/web/src/app/page.tsx`), and each story lives at
`/<category-slug>/<slug>/`.

- [jobless-rate](docs/experiments/jobless-rate) (alive) The national
  unemployment rate month by month over the last twenty years, from the
  Bureau of Labor Statistics public data API.
- [hawaii-quakes](docs/experiments/hawaii-quakes) (built, not published) One year of
  earthquakes near the Hawaiian islands, counted into half-magnitude bands,
  from the USGS earthquake catalogue.
- [cdc-county-obesity](docs/experiments/cdc-county-obesity) (built, not published) The share
  of adults with obesity in 2,956 US counties, from the CDC PLACES county
  release.

## Where things are

- `apps/web/src/lib/microsites.ts` - the story corpus. Copy, categories, and
  source citations for every microsite, published or not.
- `apps/web/src/lib/jobless-data.ts` - the fetch and transform layer for the
  jobless-rate story. Live read at build time, committed snapshot as fallback.
- `apps/web/src/components/` - chart and page components, each with unit tests.
- `packages/usa-sources/` - the vendored connectors package. Never edit by
  hand; run `node scripts/sync-connectors.mjs`.
- `docs/experiments/<slug>/` - one folder per experiment: the pitch, the data
  source, and a verdict on whether it worked.
- `skills/` - the loop skills this repo runs.

## Checks

`npm run check` runs format, lint, type-check, tests with coverage, build,
smoke, e2e, and the internal link check.
