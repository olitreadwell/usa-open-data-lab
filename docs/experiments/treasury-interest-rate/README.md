# treasury-interest-rate - the rate on the federal debt

## Pitch

The Bureau of the Fiscal Service publishes one rate for the whole federal
debt: the interest owed on it divided by the amount outstanding. That average
ran from 6.59 percent in January 2001 down to 1.56 percent in January 2022,
and has climbed since. Nothing about it moves fast, because a bond sold in
2019 still pays the coupon it was issued with while a bill sold this month
reprices at today's rates.

## Data source

US Treasury Fiscal Data, the Average Interest Rates on U.S. Treasury
Securities dataset (`v2/accounting/od/avg_interest_rates`), read at deploy
time through `@usa-open-data-connectors/usa-sources` (`treasuryAvgInterestRateAdapter`).

Four things about the dataset shape the story:

- The rows are per security. Treasury Bills, Notes, Bonds, TIPS, floating
  rate notes, savings bonds, and the government account series each get
  their own line every month. The adapter filters the request to
  `security_type_desc:eq:Interest-bearing Debt`, which is the portfolio
  total, so the individual securities never reach the parser.
- The total is a calculated ratio: aggregate interest payments divided by
  the total debt, per the dataset's own field notes. The agency leaves
  Treasury Inflation-Protected Securities and floating rate notes out of the
  total row, so the average describes the rest of the portfolio.
- One keyless request covers the whole run. The filter answers 308 monthly
  rows, January 2001 to August 2026, in about 60 KB, well inside the 10,000
  row page cap, so the adapter never pages.
- The release is monthly and every row is dated to the last day of its
  month. The dataset page said on 2026-09-28 that the next data is expected
  2026-10-06, so the newest row sits still for about a month.

`buildTreasuryRateStory` names the first, latest, highest, and lowest months,
counts the months below 2 percent, averages the first ten years against the
last ten, and finds the most recent earlier month at or above the newest
month's rate, which is what lets the copy say "highest since" without a
second source. The tests recompute the figures the prose quotes (6.59 percent
in January 2001, 1.56 percent in January 2022, the 28 months below 2 percent,
the 4.66 and 2.51 percent decade averages) from the committed snapshot, so a
refreshed file that moves them fails the suite instead of quietly making the
prose wrong.

The site is a static export, so the read happens at build time. If the
request is slow or unreachable, the build falls back to the committed
snapshot in
`apps/web/src/fixtures/treasury-avg-interest-rate-2026-09-28.json` and logs
which one it used.

## Verdict

**alive**: a fresh request on 2026-09-28 returns the same 308 monthly rows.
The built page renders 3.49 percent for August 2026, 1.56 percent for January
2022, +1.9 points since that low, and the line runs from January 2001.

## What it looks like

Three stat cards (the newest month's rate, the lowest month, and the change
since it) above a monthly line chart with the lowest month drawn as a dashed
line, and every month listed in a table behind a disclosure.

## Host notes

- `api.fiscaldata.treasury.gov` and `fiscaldata.treasury.gov` both answer 200
  to scripted requests, so the dataset page and the endpoint are linked
  directly.
- `page[size]` takes literal brackets. Sent through `URLSearchParams` they
  arrive percent-encoded as `page%5Bsize%5D`, which the API accepts; curl
  rejects the same URL until the brackets are quoted.
- A rejected request answers with an HTTP error and a body of
  `{"error":"Invalid Query Param","message":"..."}`, which the parser reports
  as an API error. A wrong dataset path answers with an HTML 404 page, which
  fails the shape check.
