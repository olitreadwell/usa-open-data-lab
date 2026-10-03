# fda-food-recalls - what the FDA takes off the shelf

## Pitch

The Food and Drug Administration publishes one record per food recall in the
food side of openFDA, and the file holds 29,463 of them, from 20 June 2012 to
23 September 2026. Class I, the grade for a food that can seriously harm or
kill, covers 12,965 of those, 44 percent of the file. Recalls peaked in 2017
at 3,203, and 2026 stands at 1,007 so far.

## Data source

openFDA food enforcement reports (`api.fda.gov/food/enforcement.json`), read
at deploy time through `@usa-open-data-connectors/usa-sources` (`openFdaFoodRecallsAdapter`).

Four things about the endpoint shape the story:

- The endpoint answers one question per request and cannot group by two fields
  at once, so the per-year Class I series comes from a second date count under
  `search=classification:"Class I"`. Five keyless requests cover the file: the
  record count, the publication dates, the Class I dates, the classification
  counts, and the initiator counts.
- A count of a date field comes back keyed by `time`, while every other field
  is keyed by `term`. The parser reads both shapes and refuses anything else.
- The two date counts have to agree with the counts they summarise. The build
  stops if the publication dates cover fewer recalls than `meta.results.total`
  reports, or if the Class I dates disagree with the Class I row of the
  classification count, so a truncated response cannot be charted as a
  smaller file.
- The file starts mid-2012 and the newest year is still open, so the first and
  last bars are partial by construction. Enforcement reports are published on
  Wednesdays, so the newest date moves once a week.

`buildOpenFdaFoodRecallSummary` folds the four counted responses into per-year
totals with Class I split out, and names the busiest year, the Class I share,
and the firm-initiated share. The tests recompute the figures the prose quotes
(29,463 records, 12,965 Class I, 3,203 in 2017, 14,736 Class II, 1,761 Class
III, 29,060 firm-initiated against 396 mandated, 1,007 so far in 2026) from
the committed snapshot, so a refreshed file that moves one fails the suite
instead of quietly making the prose wrong.

The site is a static export, so the read happens at build time. If the
request is slow or unreachable, the build falls back to the committed
snapshot in `apps/web/src/fixtures/openfda-food-recalls-2026-09-30.json` and
logs which one it used.

## Verdict

**alive**: a fresh set of five requests on 2026-09-30 returns the same 29,463
records, 12,965 Class I, 3,203 in 2017, and 1,007 so far in 2026. The built
page renders 29,463 recalls, 12,965 Class I, and 3,203 for the busiest year.

## What it looks like

Three stat cards (the size of the file, Class I and its share, and the busiest
year) above a stacked bar chart with one bar per year from 2012, the grey base
for Class II and Class III and the lime band for Class I, and every year
listed in a table behind a disclosure.

## Host notes

- `api.fda.gov` answers 200 to scripted requests and needs no key. Without
  one it allows 240 requests a minute and 1,000 a day, and the build makes
  five.
- `open.fda.gov` answers 200 for the enforcement API page and the programme
  home, so both are linked directly.
- `www.fda.gov/safety/recalls-market-withdrawals-safety-alerts` answers 200 to
  a scripted request (checked 2026-09-30) and carries the agency's own recall
  pages, so it is linked.
- A rejected query answers with HTTP 404 and a body of
  `{"error":{"code":"NOT_FOUND","message":"..."}}`, which the parser reports
  as an API error rather than a parse failure.
- The record count grows every Wednesday, so the figures quoted in the copy
  are worth re-reading at the start of each loop iteration.
