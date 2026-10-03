# cfpb-consumer-complaints - 18 million complaints against the credit bureaus

## Pitch

The Consumer Financial Protection Bureau publishes every complaint it sends
to a company. The file opens on 1 December 2011 and holds 18,145,013
complaints to 2 October 2026. The yearly count grew slowly for a decade and
then took off: 1,292,049 in 2023, 2,734,268 in 2024, 5,442,963 in 2025, and
already 5,462,631 through the first days of October 2026, past every full
year before it.

Most of the growth sits with three companies. TransUnion (5,015,681),
Equifax (4,815,296), and Experian (4,396,123) are the companies named most
often, and together they carry 14,227,100 complaints, 78.4 percent of the
file.

Read the step-by-step writeup in [TUTORIAL.md](TUTORIAL.md).

## Data source

The Consumer Complaint Database search API
(`https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/`),
read at deploy time through `@usa-open-data-connectors/usa-sources`
(`cfpbConsumerComplaintsAdapter`).

Four things about the API shape the story:

- The API computes its term aggregations on every request. `size=0` alone
  returns about 400 KB; `size=0&no_aggs=true` returns about 15 KB, so the
  count requests use `no_aggs=true` and one extra request fetches the product
  and company tallies.
- The API answers one question per request and its `aggs` parameter does not
  select anything (every request returns the same fixed set), so the window
  costs one request per year plus the tallies and one or two to find the
  newest day.
- There is no received-date sort: `sort=date_received_desc` is rejected with
  `"date_received_desc" is not a valid choice.`, so the adapter walks back day
  by day from today and stops at the first day with a complaint.
- The first year, 2011, holds December only. The bureau published its first
  complaints on 1 December 2011, and the 2,536 rows from that month are kept
  in the window with a note rather than dropped.
- Product labels are not stable. The bureau changed its taxonomy over the
  years, so credit reporting arrives under more than one label and the tally
  splits it. The story counts companies instead of products.

`buildCfpConsumerComplaintSeries` folds the year rows into counts, names the
busiest year before the newest one, and keeps the top products and companies.
The tests recompute the figures the prose quotes (18,145,013 complaints,
5,442,963 for 2025, 2,734,268 for 2024, 1,292,049 for 2023, 5,462,631 so far
for 2026, and 14,227,100 for the three bureaus) from the committed snapshot,
so a refreshed file that moves one fails the suite instead of quietly making
the prose wrong.

The site is a static export, so the read happens at build time. If the
requests are slow or unreachable, the build falls back to the committed
snapshot in `apps/web/src/fixtures/cfpb-consumer-complaints-2026-10-03.json`
and logs which one it used.

## Verdict

**alive**: a live fetch on 2026-10-03 returned 18,145,013 complaints with the
newest received date of 2 October 2026, 5,442,963 for 2025, and the same
three companies at the top, matching the committed snapshot.

## What it looks like

Three stat cards (complaints in the file, complaints so far this year, and
the count against the three bureaus) above a bar chart with one bar per
calendar year from 2011, grey for the year that is still filling, then a list
of the five companies named most often and a table of every year behind a
disclosure.

## Host notes

- `www.consumerfinance.gov` answers 200 to scripted requests for the database
  page, the API base, and the complaint-process page. A declared user agent is
  still sent, because the agency answers some paths with 403 without one.
- `cfpb.github.io/api/ccdb/` answers 200 and holds the endpoint
  documentation.
- The one failure mode worth knowing is not an HTTP error: a request the API
  cannot serve still answers 200 with a body missing the key the parser wants,
  which the zod parse turns into a thrown error rather than a smaller file.
