# jobless-rate — The Jobless Rate

## Pitch

The national unemployment rate is the single number the US publishes about
work, and it is readable without an API key. Twenty years of monthly figures
show the 2008 recession, the pandemic spike, and the tight market after it.
One month in the series is missing entirely.

## Data source

Bureau of Labor Statistics public data API, series `LNS14000000` (civilian
unemployment rate, seasonally adjusted, from the Current Population Survey),
fetched at deploy time via `@usa-open-data-connectors/usa-sources`.

Three things the API forces on the story:

- A request may span ten years at most, so twenty years takes two calls.
- A month the agency could not publish comes back with `"-"` rather than
  being left out. October 2025 is the one in this range, with a footnote
  citing the 2025 lapse in appropriations.
- The `M13` annual average is returned alongside the months and is dropped,
  so one year holds twelve values.

`buildJoblessSeries` lays out every month between the first and the last and
leaves an unpublished month empty, so the chart line breaks instead of
drawing through it.

The site is a static export, so the read happens at build time and the deploy
workflow runs daily to keep it fresh. If the API is rate limited or blocked,
the build falls back to the committed snapshot in `apps/web/src/fixtures/`,
and logs which one it used.

## Verdict

**alive** — the numbers are real, the peak is stable at April 2020, and the
missing month is the most interesting thing on the page.

## What it looks like

Three stat cards (the latest month, the peak, the change since the peak) above
a monthly line chart covering the last twenty years, with the full
month-by-month table behind a disclosure and a data-source footnote.
