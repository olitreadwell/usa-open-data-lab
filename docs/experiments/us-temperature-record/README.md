# us-temperature-record - The contiguous US temperature record

## Pitch

One calendar year of weather for the lower 48 states is a single number, and
the National Centers for Environmental Information has published that number
for every year since 1895. Stacked into decade rows, the record shows where
the last century sits: 131 years, a 20th century average of 52.01 °F, and a
run of 26 straight years from 2000 to 2025 above that average.

## Data source

NOAA NCEI Climate at a Glance, contiguous United States average temperature
(region 110, parameter `tavg`), read at deploy time through
`@usa-open-data-connectors/usa-sources` (`nceiAnnualTemperatureAdapter`).

Four things about the download shape the story:

- It is a CSV, not JSON. Two comment lines, a `Date,Value` header, then one
  row per year as `YYYYMM,value` in degrees Fahrenheit. The URL carries a
  window length and a window end month, and twelve months ending in December
  is the calendar year.
- The current year is not in the file until December has closed it, so the
  newest row is the last complete year. A partial year never reaches the
  chart.
- The series covers the contiguous 48 states. Alaska, Hawaii, and the
  territories are outside it.
- The 20th century average of 52.01 °F is the mean of the 1901 to 2000 rows
  in the same file, so the comparison line comes from the same request as
  the points.

`buildUsTemperatureStory` measures every year against that average, groups
the years into decade rows, and counts the years from 2000 on. The story
copy quotes two decade means, the 1930s at 52.63 °F and the six years since
2020 at 54.45 °F, and the tests recompute both from the committed snapshot,
so a refreshed file that moves those figures fails the suite instead of
quietly making the prose wrong.

The site is a static export, so the read happens at build time. If the
download is slow or unreachable, the build falls back to the committed
snapshot in `apps/web/src/fixtures/ncei-annual-temperature-2026-09-26.csv`
and logs which one it used.

## Verdict

**alive**: a fresh download on 2026-09-26 returns the same 131 years, the
same warmest year (2024 at 55.48 °F), the same coldest year (1917 at 50.05
°F), the same 20th century average (52.01 °F), and the same 26 of 26 years
since 2000 above it. The built page renders 55.48 °F, +2.61 °F, and 26 of 26
from that file.

## What it looks like

Three stat cards (the warmest year, the newest year against the 20th century
average, and the count of years since 2000 above it) above a strip chart with
one dot per year stacked into decade rows, warm years in the accent colour,
the 20th century average drawn as a dashed line, and every year listed in a
table behind a disclosure.
