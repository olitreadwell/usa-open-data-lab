# cdc-county-obesity - Adult obesity by county

## Pitch

PLACES is the CDC set of model-based health estimates for every US county,
keyless and in the public domain. One measure, obesity among adults, runs from
16.7 percent in Boulder County, Colorado to 52.9 percent in Perry County,
Alabama. The distribution carries the story: the median county sits at 37.9
percent, well above the release's own national figure of 32.8 percent, because
the counties with the highest rates are the smallest ones.

## Data source

CDC PLACES, county data, 2025 release, read at deploy time through
`@usa-open-data-connectors/usa-sources` (`cdcCountyObesityAdapter`).

Four things about the release shape the story:

- The resource id belongs to one release. `swc5-untb` is the 2025 release,
  whose estimates come from the 2023 Behavioral Risk Factor Surveillance
  System survey and the Census Bureau county population estimates for 2023.
- Each measure is published twice, as crude and as age-adjusted prevalence.
  The adapter reads the crude rows, because the age-adjusted ones answer a
  different question.
- The release carries no obesity rows at all for Kentucky and Pennsylvania,
  and Loving County in Texas arrives without a value on a population of 43.
  Rows without a value are dropped before anything is counted.
- The national row has no county name. The only thing marking it is the `US`
  state code, so the adapter keeps it apart from the counties instead of
  counting it as one of them.

`buildObesityBands` counts the counties into bands of two percentage points,
starting at the even number below the lowest county, so the highest county
lands inside the last band rather than past it. The median and the
population-weighted rate come from the same rows, which is what makes the
county-versus-person comparison possible without a second source.

The site is a static export, so the read happens at build time. If the
resource is slow or unreachable, the build falls back to the committed
snapshot in `apps/web/src/fixtures/cdc-county-obesity-2026-09-25.json` and
logs which one it used.

## Verdict

**alive**: a fresh call to the resource on 2026-09-25 returns the same 2,956
counties, the same extremes (16.7 percent in Boulder, Colorado and 52.9
percent in Perry, Alabama), the same median of 37.9 percent, the same
population-weighted 33.28 percent, and the same national row of 32.8 percent.
2,502 of the counties sit above that national figure.

## What it looks like

Three stat cards (the county count, the median county, the counties above the
national figure) above a histogram of two-point bands, with the national
figure and the median marked as dashed reference lines, the band table behind
a disclosure, and a data-source footnote.
