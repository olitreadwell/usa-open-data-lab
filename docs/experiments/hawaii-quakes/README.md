# hawaii-quakes — Earthquakes near Hawaii

## Pitch

The USGS publishes every earthquake its networks pick up, without a key and
without a login. One year inside a box around the main Hawaiian islands is
264 quakes at magnitude 2.5 and above, and the shape of that list says more
than the headline number: 176 of them were below magnitude 3, and five
reached magnitude 4.

## Data source

USGS earthquake catalogue, FDSN event query, read at deploy time through
`@usa-open-data-connectors/usa-sources` (`usgsHawaiiEarthquakesAdapter`).

Four things the query fixes about the story:

- The window is the 2025 calendar year. The catalogue excludes the end date,
  so `starttime=2025-01-01` with `endtime=2026-01-01` covers January to
  December exactly.
- The magnitude floor is 2.5, set in the query rather than filtered later.
  Everything below it is absent, so the counts are a slice of the year, not a
  total.
- The box runs 18.5 to 22.5 north and 161 to 154 west, which covers the main
  Hawaiian islands and the water around them.
- The feed mixes in quarry blasts and other non-tectonic events, and a row can
  arrive with no magnitude. Both are dropped in the parser before anything is
  counted.

`buildMagnitudeBands` counts the survivors into half-magnitude bands from 2.5
up, with a band holding magnitudes from its lower edge to the next one, so the
strongest quake of the year lands inside the last band instead of past it.

The site is a static export, so the read happens at build time. If the
catalogue is slow or unreachable, the build falls back to the committed
snapshot in `apps/web/src/fixtures/usgs-hawaii-earthquakes.json` and logs
which one it used.

## Verdict

**alive** — a fresh call to the catalogue on 2026-09-24 returns the same 264
earthquakes, the same four bands (176, 65, 18, 5), the same strongest
(M4.41 on 15 March 2025, 53 km west of Hawaiian Ocean View) and the same
deepest (59.8 km on 22 February 2025, 13 km west of Puako).

## What it looks like

Three stat cards (the year's count, the strongest, the count below magnitude
3) above a histogram of half-magnitude bands, with the band table behind a
disclosure and a data-source footnote.
