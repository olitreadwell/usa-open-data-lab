# Build a product recall chart from the CPSC's open file

This walks through one experiment in `usa-open-data-lab`, from the public data
source to a published page. It is written for someone who wants to do the
same thing with a different agency, a different year range, or a different
product category.

The finished page is `/society/cpsc-product-recalls/`. The code is
`apps/web/src/lib/cpsc-recall-data.ts` and
`apps/web/src/components/CpscRecallsChart.tsx`.

## What you build

A bar chart of the consumer product recalls the Consumer Product Safety
Commission published in each calendar year from 2014 to 2026. The 2026 bar is
grey because the file is still growing: it ends on 24 September 2026 and the
agency is still filing recalls for the year.

The page carries three numbers above the chart (the recall count for the
whole window, the count so far this year, and the number of recalls that name
China as a manufacturer country), a list of the five most common remedies,
and a table of all 13 years behind a disclosure.

The headline is that 2026 has already passed every complete year in the
window. That is not a guess about the rest of the year: the count of 459
through 24 September is larger than the 420 that 2025 produced in twelve
months, and larger than every year back to 2014.

## Where the data comes from

The Consumer Product Safety Commission runs SaferProducts.gov, and the same
service behind its public search answers as JSON:

```
https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2025-01-01&RecallDateEnd=2025-12-31
```

It is keyless. One request covers one calendar year, and each row holds the
recall number and date, the title, the products, the hazard text, the remedy
options, the manufacturer countries, the units affected, and the images.

The fields this story reads are `RecallNumber`, `RecallDate`, `Title`,
`Products[].Name`, `RemedyOptions[].Option`, and
`ManufacturerCountries[].Country`. Everything arrives in PascalCase, and the
nested lists arrive as arrays of objects.

A few things about the shape:

- The remedy options are nearly an enum: `Refund`, `Repair`, `Replace`,
  `Dispose`, `New Instructions`, `Label`, `Inspect`, `No Remedy Available`.
  Two rows in the whole window carry junk instead, one reading `R` and one
  repeating a paragraph of consumer instructions.
- A recall can name several manufacturer countries, so those counts add to
  more than the number of recalls. China appears on 2,312 of the 3,986
  recalls, the United States on 753, and 122 countries appear at least once.
- `NumberOfUnits` is free text, for example `About 209,000 sets in the United
  States and 23,000 sets in Canada`, so units cannot be summed. This story
  counts recalls, not products or units.
- The service holds records from 1973 (eight of them that first year). This
  story starts at 2014 to keep the window to 13 requests.

## The steps

1. **Prove the query before writing any code.** Ask for one year and read the
   rows. Check that `RecallDate` really falls inside the range you asked for,
   and check what a bad query returns.

   ```
   curl -sS "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2025-01-01&RecallDateEnd=2025-12-31" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.length, j[0].RecallNumber, j[0].RecallDate)})"
   ```

   That prints `420` rows, the first of them recall 26156 dated
   `2025-12-18T00:00:00`. Now ask for a range wider than a year and read the
   answer carefully, because it is not an error page.

2. **Write the adapter in the connectors repo, not in the site.**
   `usa-open-data-connectors` holds one module per source behind a uniform
   interface: a live fetch, a strict zod parse, and a committed fixture. The
   site vendors that package, so the adapter is reusable.

   The module is `packages/usa-sources/src/cpscProductRecalls.ts`. It exports
   `buildCpscRecallUrl`, `parseCpscRecallPayload`, `parseCpscRecallSnapshot`,
   `buildCpscProductRecallSeries`, `fetchCpscProductRecalls`, and the adapter
   object.

3. **Parse the error case first.** The parser checks for the error row before
   it filters anything, because a row that carries no date looks exactly like
   a row for another year once you start filtering.

4. **Count from the rows, and keep the window explicit.** A year with no
   recall keeps a zero row rather than disappearing, and the caller passes
   the first and newest year so the chart cannot silently shrink.

5. **Save fixtures that are honest about their size.** A year of raw rows is
   about 1.3 MB, and 13 of them is about 11 MB. Two files instead: a folded
   snapshot of the counts at `cpsc-product-recalls-2026-10-02.json` (10 KB),
   which is what the build falls back to, and a sampled rows file holding the
   first three recalls of every year, which the registry test answers each
   per-year request with.

6. **Register the adapter and document it.** Add it to `US_DATA_SOURCES` in
   `packages/usa-sources/src/registry.ts`, export it from `src/index.ts`, add
   it to the source table and the notes in `packages/usa-sources/README.md`,
   and add its host to the fixture routing in `registry.test.ts`. The HTTP
   API and the CLI read the registry, so a new adapter shows up on
   `/api/sources` without any route changes.

7. **Vendor it into the site.** `node scripts/sync-connectors.mjs --from
   ../usa-open-data-connectors` copies the package in, renames its scope to
   `@usa-open-data-lab`, and drops the `.js` import extensions. Never edit the vendored
   copy by hand.

8. **Turn the counts into the story's numbers.** In the site,
   `apps/web/src/lib/cpsc-recall-data.ts` builds one bar per year, marks the
   newest bar partial, names the busiest and quietest complete years, and
   works out the remedy shares and China's share of the file.

9. **Write the chart.** `CpscRecallsChart.tsx` draws one bar per year with
   Recharts, in the accent colour for the complete years and grey for the
   year that is still filling. Under it, a list of the five most common
   remedies and a table of every year behind a disclosure. The chart carries
   a written-out `aria-label` so the shape of the data survives without
   seeing it.

10. **Register the story.** Add the config to `apps/web/src/lib/microsites.ts`
    (slug, copy, source URL, references, accent, category, chart type), add a
    case to `renderStoryContent` and `loadStoryData` in
    `apps/web/src/app/[category]/[slug]/page.tsx`, add a page test, and only
    then add the slug to `published-microsites.ts`.

11. **Run the gate, then read the built page.** `npm run check` builds the
    static export, so `apps/web/out/society/cpsc-product-recalls/index.html`
    is the real output. Read the numbers out of that file rather than out of
    the source to confirm the page renders what you think it does.

## What actually broke

**A range wider than a year is not an error, it is a fake recall.** The
natural first query is one request for the whole window. Ask for 2014 to 2026
and the service answers HTTP 200 with a single row:

```
[{"RecallID":0,"RecallNumber":null,"RecallDate":null,
  "Title":"Error retrieving Recalls: The underlying provider failed on Open.",
  "Products":[],"RemedyOptions":[],"ManufacturerCountries":[]}]
```

A parser that trusted the status code would count that row as a recall, or
drop it as a row with no date and quietly record a year of zero recalls. The
adapter reads one year per request, and the parser turns that row into a
thrown error before it does anything else.

**The date check has to come before the year filter.** The first version
filtered rows to the requested year and then checked that the date was
readable, which meant a row dated `last Tuesday` was dropped as "not in this
year" instead of being flagged as a changed shape. The unit test for an
unreadable date failed, and the two checks swapped places.

**`exactOptionalPropertyTypes` is strict about nested arrays.** The first
version of the nested-list helper typed its rows as `{ Option?: string | null
}`, and the type checker rejected the row type the zod schema produces,
because an optional property there is `string | null | undefined`. One shared
row interface fixed it.

**The remedy list is not an enum, and the copy has to say so.** Two of the
ten values in the window are junk: one recall carries `R`, and one carries a
full paragraph of consumer instructions. The page lists the five options with
the most recalls and the data note says the tail is not a remedy at all, so a
reader is not left thinking the agency has a remedy called `R`.

**Thirteen raw years do not belong in a repository.** The first fixture plan
was to commit each year's response. That is about 1.3 MB a year, or 11 MB in
each of the two repos that keep a copy. The committed snapshot holds the
folded counts instead, which is 10 KB for the same story, and the parser is
tested against a small sampled file of real rows.

## One variation to try

Start the window at 1973, the first year the service holds, and watch the
shape of the chart change. The adapter takes a `firstYear`, so it is one
argument, and the count for that first year is eight recalls:

```
curl -sS "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=1973-01-01&RecallDateEnd=1973-12-31" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).length))"
```

That prints `8`. The trade-off is 41 more requests at build time, one per
year, and a chart that spends most of its width on a period when the agency
published far fewer recalls. A middle option is to keep 2014 as the story's
window but compute the all-time counts from a coarser source, such as the
agency's own annual reports.
