# cpsc-product-recalls - the product safety agency's busiest year in a decade

## Pitch

The Consumer Product Safety Commission writes every recall it publishes into
an open file. Between 2014 and 24 September 2026 the file holds 3,986
consumer product recalls. The 2026 count, 459, is already larger than any
complete year in the window, and the biggest complete year was 2025 at 420.
China is named as a manufacturer country on 2,312 of the recalls, and a
refund is the most common remedy, offered on 1,980.

Read the step-by-step writeup in [TUTORIAL.md](TUTORIAL.md).

## Data source

SaferProducts.gov recall service
(`https://www.saferproducts.gov/RestWebServices/Recall`), read at deploy time
through `@usa-open-data-connectors/usa-sources` (`cpscProductRecallsAdapter`).

Four things about the file shape the story:

- One request answers for one calendar year. A wider range answers HTTP 200
  with a single row reading `Error retrieving Recalls: The underlying
  provider failed on Open.`, so the adapter reads 13 requests, 2014 through
  2026. The parser turns that row into a thrown error rather than a recall.
- The newest year is partial by construction. The busiest and quietest years
  the copy names are the busiest and quietest complete years, and the newest
  recall in the file is dated 24 September 2026.
- `ManufacturerCountries` lists every country a recall touches, so the counts
  overlap. China appears on 2,312 recalls, the United States on 753, and 122
  countries appear at least once.
- `NumberOfUnits` is free text (`About 209,000 sets in the United States and
  23,000 sets in Canada`), so the page counts recalls rather than products or
  units. `RemedyOptions` is nearly an enum with two junk rows in the window,
  one reading `R` and one repeating a recall paragraph.

`buildCpscProductRecallSeries` folds the years into counts, names the busiest
and quietest complete years, and tallies the remedy options and countries.
The tests recompute the figures the prose quotes (3,986 recalls, 459 in 2026,
420 in 2025, 219 in 2021, 1,980 refunds, 2,312 recalls naming China, and 122
countries) from the committed snapshot, so a refreshed file that moves one
fails the suite instead of quietly making the prose wrong.

The site is a static export, so the read happens at build time. If the
requests are slow or unreachable, the build falls back to the committed
snapshot in `apps/web/src/fixtures/cpsc-product-recalls-2026-10-02.json` and
logs which one it used.

## Verdict

**alive**: a fresh set of 13 requests on 2026-10-02 returned the same 3,986
recalls, the same 459 for 2026, the same 2,312 recalls naming China, and the
same 24 September 2026 newest date as the committed snapshot.

## What it looks like

Three stat cards (recalls in the window, recalls so far this year, and the
count naming China) above a bar chart with one bar per calendar year from
2014, grey for the year that is still filling, then a list of the five most
common remedies and a table of every year behind a disclosure.

## Host notes

- `www.saferproducts.gov` answers 200 to scripted requests for the site root
  and for the recall endpoint.
- `www.cpsc.gov` and `www.cpsc.gov/Recalls` answer 200 to a plain scripted
  request, so both are linked directly.
- A query wider than a year is the one failure mode worth knowing: it answers
  200 with an error row rather than an HTTP error, which is why the parser
  checks the row before anything else.
