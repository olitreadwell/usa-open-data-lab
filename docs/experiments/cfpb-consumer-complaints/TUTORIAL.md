# Build a consumer complaint chart from the CFPB's open file

This walks through one experiment in `usa-open-data-lab`, from the public data
source to a published page. It is written for someone who wants to do the
same thing with a different agency, a different window, or a different cut of
the same file.

The finished page is `/economy/cfpb-consumer-complaints/`. The code is
`apps/web/src/lib/cfpb-complaints-data.ts` and
`apps/web/src/components/CfpbComplaintsChart.tsx`.

## What you build

A bar chart of the consumer complaints the Consumer Financial Protection
Bureau sent to a company in each calendar year from 2011 to 2026. The 2026
bar is grey because the file is still growing: its newest complaint was
received on 2 October 2026 and the bureau is still publishing rows for the
year.

The page carries three numbers above the chart (the complaint count for the
whole file, the count so far this year, and the count against the three
national credit bureaus), a list of the five companies named most often, and
a table of all 16 years behind a disclosure.

The headline is the jump. The yearly count stayed under a million until 2023,
then went to 2,734,268 in 2024 and 5,442,963 in 2025. Through 2 October the
2026 file already holds 5,462,631 complaints, more than any full year before
it.

## Where the data comes from

The bureau runs the Consumer Complaint Database behind its public complaint
search, and the same search answers as JSON:

```
https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?size=0&no_aggs=true&date_received_min=2025-01-01&date_received_max=2025-12-31
```

It is keyless. The response holds `hits.total.value`, the number of complaints
the query matched, which is all a count needs. Each row in the full search
holds the product, the sub-product, the issue, the company, the date the
bureau received it, the company's response, and a narrative when the consumer
consented to publish one.

A few things about the shape:

- The API computes a fixed set of term aggregations on every request unless
  `no_aggs=true` is set. `size=0` alone is about 400 KB; adding `no_aggs=true`
  takes the same count to about 15 KB.
- There is no received-date sort. `sort=date_received_desc` answers with
  `"date_received_desc" is not a valid choice.`, so the newest day has to be
  found another way.
- The database opens on 1 December 2011, so the 2011 bar covers one month. The
  first month holds 2,536 complaints.
- Credit reporting arrives under more than one product label because the
  bureau changed its taxonomy. This story counts companies instead, where the
  labels are stable.
- A complaint enters the file after the company responds or after fifteen
  days, so the last day or two always look thin.

## The steps

1. **Prove the query before writing any code.** Ask for one year and read the
   total, then ask for a wider window and see what changes.

   ```
   curl -sS "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?size=0&no_aggs=true&date_received_min=2025-01-01&date_received_max=2025-12-31" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).hits.total.value))"
   ```

   That prints `5442963`. Now time one without `no_aggs=true` and watch the
   body size, not the status code.

2. **Find the newest date before trusting the newest year.** The API has no
   received-date sort, so ask for one day at a time and stop at the first day
   with a complaint. Start at today and walk back; normally the answer is one
   or two days old.

   ```
   curl -sS "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?size=0&no_aggs=true&date_received_min=2026-10-02&date_received_max=2026-10-02" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).hits.total.value))"
   ```

   That prints `443` for 2 October 2026, the newest day in the file that day.

3. **Write the adapter in the connectors repo, not in the site.**
   `usa-open-data-connectors` holds one module per source behind a uniform
   interface: a live fetch, a strict zod parse, and a committed fixture. The
   site vendors that package, so the adapter is reusable.

   The module is `packages/usa-sources/src/cfpbConsumerComplaints.ts`. It
   exports `buildCfpComplaintCountUrl`, `buildCfpComplaintDayUrl`,
   `buildCfpComplaintAggregationUrl`, `parseCfpComplaintTotal`,
   `parseCfpComplaintAggregations`, `parseCfpComplaintSnapshot`,
   `buildCfpConsumerComplaintSeries`, `findNewestCfpComplaintDate`,
   `fetchCfpConsumerComplaints`, and the adapter object.

4. **Read the nested aggregation once and keep it.** The product and company
   tallies only exist on the response without `no_aggs=true`, so the adapter
   spends one request of about 400 KB on them and then uses the cheap
   `no_aggs=true` shape for every count. One request buys both breakdowns.

5. **Count from the rows, and keep the window explicit.** The caller passes
   the first and newest year so the chart cannot silently shrink, and a year
   with no complaint keeps a zero row. The total comes from the year rows, not
   from the tally request, because the file grows between two requests.

6. **Save one fixture, not nineteen.** The raw rows number more than eighteen
   million, so the committed snapshot holds the folded counts, the newest
   date, and the top products and companies. The registry test answers the
   per-year requests, the newest-day probe, and the tally request from that
   one file.

7. **Register the adapter and document it.** Add it to `US_DATA_SOURCES` in
   `packages/usa-sources/src/registry.ts`, export it from `src/index.ts`, add
   it to the source table and the notes in `packages/usa-sources/README.md`,
   and add its host to the fixture routing in `registry.test.ts`. The HTTP API
   and the CLI read the registry, so a new adapter shows up on `/api/sources`
   without any route changes.

8. **Vendor it into the site.** `node scripts/sync-connectors.mjs --from
   ../usa-open-data-connectors` copies the package in, renames its scope to
   `@usa-open-data-lab`, and drops the `.js` import extensions. Never edit the vendored
   copy by hand.

9. **Turn the counts into the story's numbers.** In the site,
   `apps/web/src/lib/cfpb-complaints-data.ts` builds one bar per year, marks
   the newest bar partial, and works out each company's share of the file and
   the combined share of the three bureaus.

10. **Write the chart.** `CfpbComplaintsChart.tsx` draws one bar per year with
    Recharts, in the accent colour for the complete years and grey for the
    year that is still filling. Under it, a list of the five companies named
    most often and a table of every year behind a disclosure. The chart
    carries a written-out `aria-label` so the shape of the data survives
    without seeing it.

11. **Register the story.** Add the config to `apps/web/src/lib/microsites.ts`
    (slug, copy, source URL, references, accent, category, chart type), add a
    case to `renderStoryContent` and `loadStoryData` in
    `apps/web/src/app/[category]/[slug]/page.tsx`, add a page test, and only
    then add the slug to `published-microsites.ts`.

12. **Run the gate, then read the built page.** `npm run check` builds the
    static export, so `apps/web/out/economy/cfpb-consumer-complaints/index.html`
    is the real output. Read the numbers out of that file rather than out of
    the source to confirm the page renders what you think it does.

## What actually broke

**`aggs` does not select the aggregations.** The first plan was one request
for the whole file with `aggs=date_received_year`, the way a terms aggregation
usually works. The API ignores the parameter and returns the same fixed set of
nine aggregations every time, so there is no year aggregation to read. The
adapter reads one year of totals per request instead.

**`sort=date_received_desc` is rejected.** With no date sort, the newest day
cannot be read off the top hit. The first attempt sorted by `created_date_desc`
and read the `date_received` of the first row, which is usually days older
than the newest received date. The adapter walks back from today and asks for
one day at a time, stopping at the first non-empty day.

**`size=0` is not a small request.** Asking for zero rows still computes the
full fixed aggregation set and returns about 400 KB. The unit tests passed
while the build was slow, and the fix was `no_aggs=true`, which takes a count
request to about 15 KB.

**The product tally is not one series.** The bureau renamed the credit
reporting product over the years, so the tally holds two labels that mean the
same thing, and a third narrower one. Summing them by hand is a guess about
which labels belong together. The adapter keeps the labels as the API sends
them, and the page counts companies instead, where the top three have been
stable for years.

**The file grows between requests, so the totals do not reconcile.** The
per-year requests and the tally request happen at different moments, and
complaints arrive continuously. An earlier version compared the sum of the
years against the tally total and threw when they differed, which would have
sent a healthy build to the fixture. The total now comes from the year rows,
and the tally is used only for shares.

**The repo-wide live smoke failed on a different adapter.** Running all eleven
adapters at once on 2026-10-03 tripped the pre-existing CPSC recall adapter,
which answered with its error row under the parallel load. The new adapter was
run on its own and returned the same figures as the snapshot, so the failure
was logged as pre-existing and left alone.

## One variation to try

Chart the `state` tally instead of the year counts. The same aggregation
response already carries all fifty states, so it costs no extra request, and
the shape is different: Texas leads with 2,509,581 complaints, Florida is next
at 2,487,212, and California third at 1,796,082. Switch the chart from a time
series to a ranked bar chart, and the per-capita version reorders the top of
the list, because the leaders are also the largest states. The adapter exposes
`topProducts` and `topCompanies`; adding a `topStates` field is the same
parse, one line further down the response.
