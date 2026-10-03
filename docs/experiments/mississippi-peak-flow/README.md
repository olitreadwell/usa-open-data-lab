# mississippi-peak-flow - the river's worst day each year

## Pitch

The US Geological Survey has filed the highest flow of the year at St. Louis
for 165 water years, starting in 1844. The record is 1,080,000 cubic feet per
second on 1 August 1993. Only five water years have reached 900,000, the
lowest peak is 136,000 in 1934, and no peak was filed at all for the 17 water
years from 1845 to 1861.

Read the step-by-step writeup in [TUTORIAL.md](TUTORIAL.md).

## Data source

USGS Water Data OGC API, the `peaks` collection, read at deploy time through
`@usa-open-data-connectors/usa-sources` (`usgsPeakStreamflowAdapter`).

Four things about the record shape the story:

- The rows are filed by water year, which starts on 1 October. A peak on
  8 October 1955 is filed under water year 1956, so the chart follows the
  agency's year rather than the calendar.
- The record has a hole. There is no row for the 17 water years from 1845 to
  1861, and the chart leaves those years as gaps rather than drawing them as
  zero, because a year with no filing is not a year the river ran dry.
- Each row carries the agency's own qualifiers, such as `UNKNOWNREGULATION`
  where the agency could not tell whether works upstream changed the flow, or
  `MAXDAILYMEAN` where the peak is a daily mean rather than an instantaneous
  reading. The adapter keeps them on each year.
- One keyless request covers the whole record: 165 rows in one page of about
  126 KB.

`buildPeakStreamflowStory` sorts the record, names the highest, lowest, and
middle years, counts the years at or above 900,000, and lists the missing
water years. The tests recompute the figures the prose quotes (165 years, the
1993 peak of 1,080,000, the 1903 runner-up at 1,020,000, the 1934 low at
136,000, the 511,000 middle year, the five big years, and the 17-year gap)
from the committed snapshot, so a refreshed file that moves one fails the
suite instead of quietly making the prose wrong.

The site is a static export, so the read happens at build time. If the
request is slow or unreachable, the build falls back to the committed
snapshot in
`apps/web/src/fixtures/usgs-peak-streamflow-2026-10-01.json` and logs which
one it used.

## Verdict

**alive**: a fresh request on 2026-10-01 returned the same 165 rows, the same
1993 peak of 1,080,000 cubic feet per second, and the same 136,000 low for
1934. Six scripted requests in a row answered 200 with an identical 126 KB
body.

## What it looks like

Three stat cards (the record peak and its date, the middle water year, and
the count of years above 900,000) above a bar chart with one bar per water
year from 1844, the grey bars for ordinary years and the violet bars for the
five that reached 900,000, a dashed line at the middle year, and every year
listed in a table behind a disclosure.

## Host notes

- `api.waterdata.usgs.gov` answers 200 to scripted requests, every time in
  the window this adapter was written in.
- `waterdata.usgs.gov` answers 200 for the station page after a redirect to
  the hyphenated location id, and `waterservices.usgs.gov/docs/` and
  `api.waterdata.usgs.gov/docs/` both answer 200, so all three are linked
  directly.
- The older `waterservices.usgs.gov/nwis/stat/` statistics service answers
  `HTTP 503 Service unavailable` to about half of scripted requests, and
  rejects `format=json` outright with `unknown format: json`. That is why the
  adapter reads the OGC API instead, and it is worth remembering before
  reaching for the older host on a build path.
- `www.usgs.gov` answers 403 to scripted requests, so the Water Science
  School pages are not linked.
