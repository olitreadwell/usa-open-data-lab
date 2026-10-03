# battery-sea-level - The Battery sea level record

## Pitch

The tide gauge at The Battery, at the southern tip of Manhattan, has
published a monthly mean sea level since 1856, the longest such record in the
country. Read as calendar-year averages, the record climbs 0.48 m across 155
years, the fitted trend is 2.95 mm a year, and the ten highest years all fall
between 2010 and 2025.

## Data source

NOAA CO-OPS Tides and Currents, the `monthly_mean` product for station
8518750 (The Battery), read at deploy time through `@usa-open-data-connectors/usa-sources`
(`noaaSeaLevelAdapter`).

Four things about the product shape the story:

- One request covers the whole record. The product answers one row per month
  rather than one row per reading, so 170 years cost one call of about 460 KB.
- The values are metres against the station MSL datum, the mean of hourly
  heights over the 1983 to 2001 National Tidal Datum Epoch. One fixed epoch
  is what makes a year from the 1870s comparable with 2025.
- The agency answers a row for every month in the window and leaves the value
  blank when it has none. Blank rows are dropped and a year is averaged over
  the months it does have, so 1920 is an average of seven months and 1861 and
  the run from 1879 to 1892 are missing entirely.
- The window ends with the last complete calendar year. The current year
  joins the record once December has closed it, so a partial year never
  reaches the chart.

`buildSeaLevelStory` averages the months into years, exposes the highest and
lowest years, fits the trend through the annual means, and reports the ten
highest years so the copy can say when they fall. The tests recompute the
figures the prose quotes (19 inches, 0.48 m, 2.95 mm a year, 0.354 m and
0.131 m for the ten oldest and ten newest years) from the committed snapshot,
so a refreshed file that moves them fails the suite instead of quietly making
the prose wrong.

The site is a static export, so the read happens at build time. If the
download is slow or unreachable, the build falls back to the committed
snapshot in `apps/web/src/fixtures/noaa-sea-level-2026-09-27.json` and logs
which one it used.

## Verdict

**alive**: a fresh request on 2026-09-27 returns the same 1855 monthly values.
The built page renders 155 years, the 1856 annual mean of -0.36 m, the 2025
mean of +0.12 m, the +0.48 m rise, the 2.95 mm a year trend, and the ten
highest years inside 2010 to 2025 from that file.

## What it looks like

Three stat cards (the rise since 1856, the newest year against the datum, and
the trend) above a dot plot with one dot per year, the datum drawn as a
dashed line, the fitted trend drawn as a straight line, and every year listed
in a table behind a disclosure.

## Host notes

- `api.tidesandcurrents.noaa.gov` answers 200 to scripted requests.
- `tidesandcurrents.noaa.gov` answers 200 for the station page, the sea level
  trends page, and the tidal datums page, so all three are linked directly.
- A level error comes back in the body with HTTP 200 as
  `{"error":{"message":"..."}}`, which the parser reports as an API error. A
  wrong product name answers with plain text, which fails the shape check.
