# Build a river flood chart from a live USGS feed

This walks through one experiment in `usa-open-data-lab`, from the public data
source to a published page. It is written for someone who wants to do the
same thing with a different river, gauge, or agency.

The finished page is `/environment/mississippi-peak-flow/`. The code is
`apps/web/src/lib/peak-streamflow-data.ts` and
`apps/web/src/components/PeakStreamflowChart.tsx`.

## What you build

A bar chart of the highest flow in every water year at the Mississippi River
at St. Louis, from 1844 to 2025. Five bars in that chart are the point of the
story: the river has passed 900,000 cubic feet per second only five times.

The page carries three numbers above the chart (the record peak and the date
it fell on, the middle year of the record, and the count of years above the
threshold), a table of all 165 years behind a disclosure, and a data note
that says where each number came from.

## Where the data comes from

The US Geological Survey runs the National Water Information System, and
publishes it two ways:

- `https://waterdata.usgs.gov/monitoring-location/USGS-07010000/` is the
  human page for one gauge.
- `https://api.waterdata.usgs.gov/ogcapi/v0/` is the machine interface. It is
  an OGC API, so it answers a normal filtered query and returns a GeoJSON
  feature collection.

The layer this story reads is `peaks`: one row per water year, holding the
highest flow that year, the date it fell on, and the agency's qualifiers.
The gauge is `USGS-07010000`, the Mississippi River at St. Louis, and the
parameter is `00060`, discharge in cubic feet per second.

The whole request is:

```
https://api.waterdata.usgs.gov/ogcapi/v0/collections/peaks/items?monitoring_location_id=USGS-07010000&parameter_code=00060&limit=500
```

It is keyless, it answers in about a second, and it returns 165 rows for this
gauge.

## The steps

1. **Find the layer.** List the collections on the API
   (`https://api.waterdata.usgs.gov/ogcapi/v0/collections`) and read the ids.
   `peaks` and `daily` are the two that matter for streamflow. `peaks` is the
   right one for this story because a year is one row, not 365.

2. **Prove the query before writing any code.** Ask for the gauge with a
   small `limit`, check that `properties.value`, `properties.time`, and
   `properties.water_year` are the fields you expect, and check that the
   filter really applied by looking at `monitoring_location_id` on every row.

3. **Write the adapter in the connectors repo, not in the site.**
   `usa-open-data-connectors` holds one module per source behind a uniform
   interface: a live fetch, a strict zod parse, and a committed fixture. The
   site vendors that package, so the adapter work is reusable.

   The module is `packages/usa-sources/src/usgsPeakStreamflow.ts`. It exports
   `buildUsgsPeakStreamflowUrl`, `parseUsgsPeakStreamflowPayload`,
   `buildUsgsPeakStreamflowSeries`, `fetchUsgsPeakStreamflow`, and the adapter
   object itself.

4. **Save a real fixture and let it drive the tests.** The response for this
   gauge is 126 KB, so it is committed as
   `usgs-peak-streamflow-2026-10-01.json` with a `note` field recording what
   it covers. Every test after that runs offline against the fixture, and the
   fixture is also the build's fallback when the API is unreachable.

5. **Register the adapter and document it.** Add the adapter to
   `US_DATA_SOURCES` in `packages/usa-sources/src/registry.ts`, export it
   from `src/index.ts`, add it to the source table and the notes in
   `packages/usa-sources/README.md`, and add its host to the fixture routing
   in `registry.test.ts`. The HTTP API and the CLI read the registry, so a
   new adapter shows up on `/api/sources` without any route changes.

6. **Vendor it into the site.** `node scripts/sync-connectors.mjs --from
   ../usa-open-data-connectors` copies the package in, renames its scope to
   `@usa-open-data-lab`, and drops the `.js` import extensions. Never edit the vendored
   copy by hand.

7. **Turn the record into the story's numbers.** In the site,
   `apps/web/src/lib/peak-streamflow-data.ts` maps each row to a chart bar,
   names the record, the runner-up, the lowest year, and the middle year,
   counts the years at or above 900,000, and lists the water years with no
   row at all.

8. **Write the chart.** `PeakStreamflowChart.tsx` draws one bar per water
   year with Recharts, split into two stacked series so the five big years
   get their own colour, with a dashed line at the middle year and a table of
   every year behind a disclosure. The chart carries a written-out
   `aria-label` so the shape of the data survives without seeing it.

9. **Register the story.** Add the config to `apps/web/src/lib/microsites.ts`
   (slug, copy, source URL, references, accent, category, chart type), add a
   case to `renderStoryContent` and `loadStoryData` in
   `apps/web/src/app/[category]/[slug]/page.tsx`, add a page test, and only
   then add the slug to `published-microsites.ts`.

10. **Run the gate, then look at the built page.** `npm run check` builds the
    static export, so `apps/web/out/environment/mississippi-peak-flow/index.html`
    is the real output. Read the numbers out of that file rather than out of
    the source to confirm the page renders what you think it does.

## What actually broke

**The older USGS statistics service is not usable from a build.** The obvious
first choice was `https://waterservices.usgs.gov/nwis/stat/`, which returns
annual statistics as tab-separated text. It answers `HTTP 503 Service
unavailable` to roughly half of scripted requests, and returns a header with
no rows on others. It also rejects `format=json` outright with `unknown
format: json`. Six requests to the newer OGC API in the same window all
answered 200 with an identical body, so the adapter reads the OGC API. This
is worth checking before wiring any USGS service into a build.

**A water year is not a calendar year.** A peak on 8 October 1955 is filed
under water year 1956, because a water year starts on 1 October. The first
version of the summary compared `water_year` with the year in the date string
and quietly disagreed with itself. The adapter now keeps `waterYear` and
`calendarYear` as separate fields and says in the docs which one the record
is sorted by.

**Two guessed numbers in the first test were wrong.** The test file was
written before the fixture was read closely, guessing a median of 487,000 and
a gap of 18 water years. The fixture says 511,000 and 17. Both were caught by
running the test against the real snapshot, which is the reason the fixture
exists.

**The a11y gate was flaking before this story landed.** The axe end-to-end
test failed at random on about one page in fifty with `page-has-heading-one`,
always on the seven stories whose data loads through a suspense boundary. The
static export writes those pages as a loading skeleton plus the real content
in a hidden container, and React swaps the content in on the frame after
load. Analysing the page before that swap reads the skeleton, which has no
heading. The fix is in `apps/web/e2e/microsites-a11y.spec.ts`: wait for the
`role="status"` skeleton to leave the page before running axe. Two runs of
216 repetitions passed after the change, against four failures in a single
216-repetition run before it.

## One variation to try

Point the same adapter at a different gauge and see the story change shape.
The Colorado River at Lees Ferry is `USGS-09380000`, and its peak record
covers 104 water years, from 1884 to 2023:

```
node -e "fetch('https://api.waterdata.usgs.gov/ogcapi/v0/collections/peaks/items?monitoring_location_id=USGS-09380000&parameter_code=00060&limit=500').then(r=>r.json()).then(d=>console.log(d.features.length))"
```

That prints `104`. Glen Canyon Dam started holding the river back in 1963,
so the peaks either side of that year tell a different story from the ones at
St. Louis, where weather drives them. The adapter takes a
`monitoringLocationId`, so the change is one argument, and the chart is the
same component.
