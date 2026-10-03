# fema-disaster-declarations - what FEMA declares

## Pitch

FEMA writes one row into an open file for every disaster it declares, and the
rows run back to a tornado in Georgia in May 1953. There are 5,272 of them.
Fire is the most common hazard on the file at 1,785 rows, and 2020 is the
busiest single year at 315, with 165 of those filed for COVID-19.

## Data source

OpenFEMA, the Fema Web Disaster Declarations file
(`v1/FemaWebDisasterDeclarations`), read at deploy time through
`@usa-open-data-connectors/usa-sources` (`femaDisasterDeclarationsAdapter`).

Four things about the file shape the story:

- One row is one declaration, not one county. The companion
  DisasterDeclarationsSummaries file carries a row per designated area, so a
  single hurricane can be 40 rows there; this file keeps it to one, which is
  what makes a per-year count readable.
- Every row names a program (Major Disaster 2,942, Fire Management 1,213,
  Emergency 654, Fire Suppression 463) and a hazard. The adapter counts the
  hazard, so a fire declared as an Emergency still lands in the fire band.
- One keyless request covers the whole file. Asking for 10,000 rows with an
  inline count answers 5,272 rows in about 900 KB, well inside the cap, so
  the adapter never pages. A response that comes back short of the agency's
  own count stops the parse instead of charting half a file.
- The newest year is always partial. Rows dated to 2026 stop at the newest
  declaration the agency has published, which was 25 September on 2026-09-29,
  so the last bar on the chart is short by construction and grows on its own.

`buildFemaDeclarationStory` splits each year into fire and everything else,
names the busiest year and the busiest month, counts the 2020 biological
rows, and works out fire's share of each decade. The tests recompute the
figures the prose quotes (5,272 rows, 1,785 fire rows, 315 in 2020, 142 in
March 2020, 165 for COVID-19, the 2 rows in the 1950s against 574 in the
2000s) from the committed snapshot, so a refreshed file that moves one fails
the suite instead of quietly making the prose wrong.

The site is a static export, so the read happens at build time. If the
request is slow or unreachable, the build falls back to the committed
snapshot in
`apps/web/src/fixtures/fema-disaster-declarations-2026-09-29.json` and logs
which one it used.

## Verdict

**alive**: a fresh request on 2026-09-29 returns the same 5,272 rows. The
built page renders 5,272 declarations, 315 for the busiest year, and 1,785
for fire.

## What it looks like

Three stat cards (the size of the file, the busiest year, and the fire rows)
above a stacked bar chart with one bar per year from 1953, the grey base for
every other hazard and the indigo band for fire, and every year listed in a
table behind a disclosure.

## Host notes

- `www.fema.gov` answers 200 to scripted requests for the API and the
  OpenFEMA dataset pages, so both are linked directly.
- `www.fema.gov/disaster/declarations` and the disaster pages under
  `/disaster/<number>` answer 403 to a scripted request and, checked in a
  browser on 2026-09-29, answer "Access Denied" there too, so they are not
  linked.
- A rejected query answers with an HTTP 400 and a body of
  `{"error":[{"type":"$select criteria error","message":"..."}]}`, which the
  parser reports as an API error. An unknown dataset path answers with an
  HTML 404 page, which fails the shape check.
- The row count grows by a handful a week, so the file size quoted in the
  copy is worth re-reading at the start of each loop iteration.
