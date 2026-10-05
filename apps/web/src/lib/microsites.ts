import type { MicrositeAccent } from '@/components/microsite-styles';
import type { MicrositeReference } from '@/components/MicrositeReferences';

import { withHiddenMicrositesRemoved } from './hidden-microsites';
import { PUBLISHED_MICROSITES } from './published-microsites';

/** Who publishes the underlying data for a microsite story. */
export type MicrositeDataSource =
  | 'Bureau of Labor Statistics (BLS)'
  | 'US Census Bureau'
  | 'US Geological Survey'
  | 'National Weather Service'
  | 'Environmental Protection Agency'
  | 'Centers for Disease Control (CDC)'
  | 'Federal Aviation Administration'
  | 'Federal Emergency Management Agency (FEMA)'
  | 'US Food and Drug Administration (FDA)'
  | 'National Oceanic and Atmospheric Administration (NOAA)'
  | 'Consumer Product Safety Commission (CPSC)'
  | 'Consumer Financial Protection Bureau (CFPB)'
  | 'US Department of the Treasury'
  | 'data.gov'
  | 'OpenStreetMap'
  | 'Wikipedia & Wikidata';

/** The main visualisation used by a microsite story. */
export type MicrositeChartType =
  | 'Line chart'
  | 'Bar chart'
  | 'Rank / slope'
  | 'Map'
  | 'Search & table'
  | 'Tree'
  | 'Pyramid'
  | 'Histogram'
  | 'Scatter'
  | 'Rose / polar'
  | 'Sunburst'
  | 'Streamgraph'
  | 'Cycle plot'
  | 'Dumbbell'
  | 'Ridgeline'
  | 'Waffle'
  | 'Parallel coordinates'
  | 'Tile grid'
  | 'Dot plot'
  | 'Choropleth'
  | 'Marimekko'
  | 'Pareto'
  | 'Heatmap'
  | 'Strip chart'
  | 'Bar-in-bar';

/** The subject area a microsite story belongs to. */
export type MicrositeCategory =
  | 'Agriculture & food'
  | 'Biodiversity & nature'
  | 'Census & population'
  | 'Economy & business'
  | 'Education'
  | 'Energy & climate'
  | 'Environment & geography'
  | 'Health'
  | 'Open data & digital'
  | 'Society & community'
  | 'Transport';

/** URL slug for each microsite category, used for /category-slug/ routes. */
export const CATEGORY_SLUGS: Record<MicrositeCategory, string> = {
  'Agriculture & food': 'agriculture',
  'Biodiversity & nature': 'biodiversity',
  'Census & population': 'census',
  'Economy & business': 'economy',
  Education: 'education',
  'Energy & climate': 'energy',
  'Environment & geography': 'environment',
  Health: 'health',
  'Open data & digital': 'open-data',
  'Society & community': 'society',
  Transport: 'transport',
};

/** Category slug for a microsite config. */
export function categorySlugFor(microsite: Pick<MicrositeConfig, 'category'>): string {
  return CATEGORY_SLUGS[microsite.category];
}

/** Category label for a category slug, or undefined when unknown. */
export function categoryLabelForSlug(slug: string): MicrositeCategory | undefined {
  return (Object.entries(CATEGORY_SLUGS) as [MicrositeCategory, string][]).find(
    ([, candidate]) => candidate === slug,
  )?.[0];
}

/** Canonical story path for a microsite: /category-slug/slug/. */
export function micrositePathFor(microsite: Pick<MicrositeConfig, 'slug' | 'category'>): string {
  return `/${CATEGORY_SLUGS[microsite.category]}/${microsite.slug}/`;
}

/** Other published microsites in the same category, same data source ranked first. */
export function relatedMicrositesFor(
  microsite: Pick<MicrositeConfig, 'slug' | 'category' | 'dataSource'>,
  limit = 4,
): MicrositeConfig[] {
  return [...SHOWN_MICROSITES]
    .filter(
      (candidate) => candidate.slug !== microsite.slug && candidate.category === microsite.category,
    )
    .sort((first, second) => {
      const firstSameSource = first.dataSource === microsite.dataSource ? 0 : 1;
      const secondSameSource = second.dataSource === microsite.dataSource ? 0 : 1;
      return firstSameSource - secondSameSource;
    })
    .slice(0, limit);
}

/** Human-readable freshness line for one microsite, from its data note. */
export function freshnessLabelFor(microsite: Pick<MicrositeConfig, 'dataNote'>): string {
  return microsite.dataNote.includes('live from the browser')
    ? 'Live data, loaded from your browser'
    : 'Data fetched at deploy time; the site redeploys daily';
}

export interface MicrositeConfig {
  slug: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  paragraphs: string[];
  /** Three to five headline facts, pulled from the story's own numbers. */
  keyFacts: string[];
  /** One-line reading guide for the page's main chart. */
  howToRead: string;
  /** Canonical data source URL, reused from the reference list. */
  sourceUrl: string;
  accent: MicrositeAccent;
  dataSource: MicrositeDataSource;
  chartType: MicrositeChartType;
  category: MicrositeCategory;
  dataNote: string;
  references: MicrositeReference[];
}

export const CATEGORY_DETAILS: Record<MicrositeCategory, string> = {
  'Agriculture & food': 'Crop acreage, livestock counts, and what the country eats.',
  'Biodiversity & nature':
    'Species records, protected land, and the citizen-science sets behind them.',
  'Census & population':
    'Who lives where, how old they are, and how the picture shifted between censuses.',
  'Economy & business': 'Jobs, prices, pay, and the shape of the business register.',
  Education: 'Schools, enrolment, and qualifications, open by district and state.',
  'Energy & climate': 'Generation, emissions, and the weather records behind them.',
  'Environment & geography': 'Rivers, coastlines, public land, and the map underneath it all.',
  Health: 'Hospitals, coverage, and public health counts at county level.',
  'Open data & digital': 'Live searches across the federal data catalogues.',
  'Society & community': 'Local services and the things people rely on day to day.',
  Transport: 'Roads, rail, flights, and the counters that watch them.',
};

export const MICROSITES: MicrositeConfig[] = withHiddenMicrositesRemoved<MicrositeConfig>([
  {
    slug: 'jobless-rate',
    keyFacts: [
      'Peak of 14.8 percent in April 2020, the highest month in the series.',
      'Lowest month was 3.4 percent in April 2023.',
      'October 2025 is missing: the agency could not publish it during the 2025 lapse in appropriations.',
    ],
    howToRead:
      'The line shows the national rate each month; the break near the end is a month with no published figure.',
    sourceUrl: 'https://data.bls.gov/timeseries/LNS14000000',
    label: 'Jobless rate',
    eyebrow: 'the jobless rate',
    title: 'Unemployment peaked at 14.8 percent in April 2020.',
    description:
      'The monthly national unemployment rate has run from 14.8 percent in April 2020 down to 3.4 percent in April 2023. Twenty years of monthly figures come from the Bureau of Labor Statistics, and one month in the series does not exist.',
    paragraphs: [
      'The Bureau of Labor Statistics runs the Current Population Survey and publishes the rate every month. The chart reads the last twenty years, up to the newest month the agency has published, so it still holds the 2008 recession and the pandemic.',
      'October 2025 is empty. The agency marked that month unavailable because of the 2025 lapse in appropriations, and it carried that footnote through in place of a number. The chart leaves the month blank rather than drawing through it.',
      'The rate only counts people who are out of work and actively looking. People who have stopped looking are not in the number, which is why the rate can fall while the share of adults in work also falls.',
    ],
    accent: 'teal',
    dataSource: 'Bureau of Labor Statistics (BLS)',
    chartType: 'Line chart',
    category: 'Economy & business',
    dataNote:
      'Data: Bureau of Labor Statistics public data API, series LNS14000000 (the civilian unemployment rate, seasonally adjusted, from the Current Population Survey). Twenty years of monthly figures, read at deploy time in two requests because the API caps a single request at ten years. A month the agency could not publish is marked with a dash in the response and left empty on the chart; October 2025 is the only one in this range, with a footnote citing the 2025 lapse in appropriations. The annual average period the API also returns is dropped, so one year holds twelve monthly values.',
    references: [
      {
        label: 'Unemployment rate, series LNS14000000 (BLS)',
        url: 'https://data.bls.gov/timeseries/LNS14000000',
        kind: 'data',
      },
      {
        label: 'BLS public data API, the endpoint this site reads',
        url: 'https://api.bls.gov/publicAPI/v2/timeseries/data/LNS14000000',
        kind: 'data',
      },
      {
        label: 'UNRATE, the same series on FRED (St. Louis Fed)',
        url: 'https://fred.stlouisfed.org/series/UNRATE',
        kind: 'data',
      },
    ],
  },
  {
    slug: 'hawaii-quakes',
    keyFacts: [
      '264 earthquakes of magnitude 2.5 or higher were catalogued near Hawaii in 2025.',
      '176 of them, two thirds of the year, were below magnitude 3.',
      'The strongest was an M4.41 on 15 March 2025, 53 km west of Hawaiian Ocean View.',
      'The deepest was 59.8 km down, 13 km west of Puako, on 22 February 2025.',
      'Pahala appears in 113 of the 264 place fields, so most of the year was one corner of the island.',
    ],
    howToRead:
      'Each bar counts the earthquakes inside a half step of magnitude, lowest first, so the leftmost bar is the busiest.',
    sourceUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/',
    label: 'Hawaii earthquakes',
    eyebrow: 'earthquakes near Hawaii',
    title: 'Hawaii catalogued 264 earthquakes in 2025, and two thirds were below magnitude 3.',
    description:
      'The USGS earthquake catalogue lists 264 quakes of magnitude 2.5 or higher around the Hawaiian islands in 2025. Most were small enough that nobody felt them, one reached M4.41 in March, and the deepest was 59.8 km down.',
    paragraphs: [
      'The catalogue comes from the USGS FDSN event query, the same feed the agency publishes on its own maps. It is keyless and public domain. The query behind this page asks for one year inside a box around the main Hawaiian islands, magnitude 2.5 and up, and the page counts the answer into half steps of magnitude.',
      'Small earthquakes outnumber large ones, so the bars fall away from left to right: 176 of the 264 sat between magnitude 2.5 and 3, and the whole year produced five at magnitude 4 or above. Pahala shows up in 113 of the place fields, which is one corner of the island carrying most of the year.',
      'Magnitude 2.5 is a floor, not a natural break. The networks record plenty below it, and the catalogue keeps quarry blasts and other non-tectonic events in the same feed. Those rows are dropped before anything is counted, so every bar is an earthquake.',
    ],
    accent: 'cyan',
    dataSource: 'US Geological Survey',
    chartType: 'Histogram',
    category: 'Environment & geography',
    dataNote:
      'Data: USGS earthquake catalogue, FDSN event query, read at deploy time without a key. The window is 1 January 2025 to 1 January 2026, which the catalogue reads as the end date excluded; the magnitude floor is 2.5; the box runs 18.5 to 22.5 north and 154 to 161 west. Rows the catalogue flags as something other than a tectonic earthquake, and rows with no magnitude or depth, are dropped before counting. The survivors are binned into half-magnitude bands from 2.5 up. If the catalogue is slow or unreachable at build time the page falls back to the committed snapshot in apps/web/src/fixtures and says so in the build log.',
    references: [
      {
        label: 'USGS earthquake catalogue, FDSN event query',
        url: 'https://earthquake.usgs.gov/fdsnws/event/1/',
        kind: 'data',
      },
      {
        label: 'The strongest quake of the year, event hv74634117',
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/hv74634117',
        kind: 'data',
      },
      {
        label: 'ANSS Comprehensive Earthquake Catalog (ComCat)',
        url: 'https://earthquake.usgs.gov/data/comcat/',
        kind: 'data',
      },
    ],
  },
  {
    slug: 'cdc-county-obesity',
    keyFacts: [
      'The lowest estimate in the release is 16.7 percent in Boulder County, Colorado.',
      'The highest is 52.9 percent in Perry County, Alabama.',
      "The median county sits at 37.9 percent, above the release's own national figure of 32.8 percent.",
      '2,502 of the 2,956 counties come in above that national figure.',
      'The 100 counties with the highest rates hold 0.8 percent of the people counted here.',
    ],
    howToRead:
      'Each bar counts the counties inside a two-point band of prevalence, so the tallest bar is the band around the median county; the dashed lines mark the national figure and the median.',
    sourceUrl: 'https://data.cdc.gov/d/swc5-untb',
    label: 'County obesity',
    eyebrow: 'adult obesity by county',
    title: 'Adult obesity in US counties runs from 16.7 percent to 52.9 percent.',
    description:
      "The CDC puts the lowest county estimate in Boulder County, Colorado at 16.7 percent and the highest in Perry County, Alabama at 52.9 percent. The median county sits at 37.9 percent, and most counties are above the release's own national figure of 32.8 percent.",
    paragraphs: [
      'PLACES is the CDC set of county-level health estimates. Each figure is built from the Behavioral Risk Factor Surveillance System survey and census population counts, so a county of a few thousand people gets a number without being surveyed on its own. This page reads the 2025 release, which uses the 2023 survey, and keeps the crude prevalence rows for obesity among adults.',
      'The counties with the highest rates are the smallest ones. The median county sits at 37.9 percent, while the same estimates weighted by population come to 33.3 percent, half a point from the national row the release publishes at 32.8 percent. The 100 counties with the highest rates hold 0.8 percent of the people counted here.',
      'Two things are missing. The release carries no obesity estimate for Kentucky or Pennsylvania, and Loving County in Texas arrives with a blank value on a population of 43, so the counts here cover 2,956 counties across 48 states and the District of Columbia. These are model-based estimates rather than measured counts, which makes them useful for comparing places and unsuitable for judging whether a local program worked.',
    ],
    accent: 'rose',
    dataSource: 'Centers for Disease Control (CDC)',
    chartType: 'Histogram',
    category: 'Health',
    dataNote:
      'Data: CDC PLACES, Local Data for Better Health county data, 2025 release, read at deploy time without a key. The query asks the release for measure OBESITY at crude prevalence, which comes back as about three thousand county rows in one request. The estimates are model-based, built from the 2023 Behavioral Risk Factor Surveillance System survey and the Census Bureau county population estimates for 2023. Rows without a value are dropped, the release row for the United States is kept apart from the counties, and Kentucky and Pennsylvania carry no obesity rows at all in this release. If the endpoint is slow or unreachable at build time the page falls back to the committed snapshot in apps/web/src/fixtures and says so in the build log.',
    references: [
      {
        label: 'PLACES: Local Data for Better Health, county data, 2025 release (CDC)',
        url: 'https://data.cdc.gov/d/swc5-untb',
        kind: 'data',
      },
      {
        label: 'The resource endpoint this site reads',
        url: 'https://data.cdc.gov/resource/swc5-untb.json',
        kind: 'data',
      },
      {
        label: 'PLACES program and methods (CDC)',
        url: 'https://www.cdc.gov/places/index.html',
        kind: 'data',
      },
    ],
  },
  {
    slug: 'us-temperature-record',
    keyFacts: [
      '2024 is the warmest year in the record at 55.48 °F.',
      '1917 is the coldest at 50.05 °F, 5.43 degrees lower.',
      'Every year from 2000 to 2025 sits above the 20th century average of 52.01 °F.',
      '2025 came in at 54.62 °F, 2.61 degrees above that average.',
      'The 1930s is the warmest decade before 1980, and the six years since 2020 average 1.82 degrees above it.',
    ],
    howToRead:
      'Each dot is one year, and the rows run from the 1890s at the top to the 2020s at the bottom; the dashed line is the 20th century average.',
    sourceUrl:
      'https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/national/time-series/110/tavg/12/12/1895-2026.csv',
    label: 'US temperature record',
    eyebrow: 'the US temperature record',
    title: 'Every year since 2000 has run warmer than the 20th century average.',
    description:
      'The contiguous United States averaged 52.01 °F across the 20th century, and every year since 2000 has come in above that line. The warmest year in the record is 2024 at 55.48 °F, and the coldest is 1917 at 50.05 °F.',
    paragraphs: [
      'The National Centers for Environmental Information averages thousands of station readings into one temperature for each month, then into one figure for the calendar year. The record starts in 1895 and covers the contiguous 48 states, so Alaska, Hawaii, and the territories are outside it.',
      'The chart stacks the 131 years into decade rows, oldest at the top, and the rows drift right as you read down. The 1930s is the warmest decade in the first 85 years of the record at 52.63 °F. The six years published this decade average 54.45 °F, 1.82 degrees above it. Every one of the 26 years from 2000 to 2025 sits above the 20th century average.',
      'Two things about the numbers. The record is an average over a large area rather than a reading from one place, so a warm year here does not mean every state had one. The current year joins the file only after December has closed it, which is why the newest row here is a complete year rather than a partial one.',
    ],
    accent: 'amber',
    dataSource: 'National Oceanic and Atmospheric Administration (NOAA)',
    chartType: 'Strip chart',
    category: 'Energy & climate',
    dataNote:
      'Data: NOAA NCEI Climate at a Glance, the contiguous United States average temperature series (parameter tavg, region 110), read at deploy time without a key. One request returns one row per calendar year from 1895, in degrees Fahrenheit, as a twelve month window ending in December, so the newest row is the last complete year and the current year joins only after December. The 20th century average of 52.01 °F is the mean of the 1901 to 2000 rows in the same file. The series covers the contiguous 48 states and leaves out Alaska, Hawaii, and the territories. If the download is slow or unreachable at build time the page falls back to the committed snapshot in apps/web/src/fixtures and says so in the build log.',
    references: [
      {
        label: 'Climate at a Glance (NOAA NCEI)',
        url: 'https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/',
        kind: 'data',
      },
      {
        label: 'The annual temperature download this site reads (contiguous US, 1895 onwards)',
        url: 'https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/national/time-series/110/tavg/12/12/1895-2026.csv',
        kind: 'data',
      },
      {
        label: 'National Climate Report, monthly and annual summaries (NOAA NCEI)',
        url: 'https://www.ncei.noaa.gov/access/monitoring/monthly-report/national',
        kind: 'data',
      },
    ],
  },
  {
    slug: 'battery-sea-level',
    keyFacts: [
      'The record holds 155 years, from 1856 to 2025, with fifteen calendar years missing.',
      '2025 averaged 0.12 m above the datum, and 1856 averaged 0.36 m below it.',
      'The fitted trend is 2.95 mm a year across the whole record.',
      'The ten highest years all fall between 2010 and 2025.',
      'The lowest year is 1874, at 0.39 m below the datum.',
    ],
    howToRead:
      'Each dot is one year, running left to right from 1856 to 2025. The dashed line is the datum the heights are measured against, and the straight line is the trend fitted through the whole record.',
    sourceUrl: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8518750',
    label: 'Battery sea level',
    eyebrow: 'sea level at The Battery',
    title: 'Sea level at The Battery has risen 19 inches since 1856.',
    description:
      'The tide gauge at The Battery in New York has been reading the water since 1856. Across 155 years of annual means it has climbed 0.48 m, or 19 inches, and the ten highest years in the record all fall in the last sixteen.',
    paragraphs: [
      'The gauge stands at the southern tip of Manhattan and has published a monthly mean since 1856, the longest such record in the country. The heights on this page are metres against the MSL datum for the station, the average of hourly readings over the 1983 to 2001 tidal epoch, which is what makes a year from the 1870s comparable with last year.',
      'Fitted across the record, the annual mean climbs 2.95 mm a year, and the rise is not spread evenly. The ten oldest years in the record average 0.354 m below the datum, the ten newest average 0.131 m above it, and every one of the ten highest years sits between 2010 and 2025.',
      'Two things about the numbers. Fifteen calendar years carry no monthly value at all, which is 1861 and the run from 1879 to 1892, so the dots skip them, and 1920 holds seven months rather than twelve. This is also relative sea level at one station: the reading is taken against a fixed reference on land, so it combines the rise of the sea with any local movement of the ground underneath.',
    ],
    accent: 'sky',
    dataSource: 'National Oceanic and Atmospheric Administration (NOAA)',
    chartType: 'Dot plot',
    category: 'Environment & geography',
    dataNote:
      'Data: NOAA CO-OPS Tides and Currents, the monthly mean sea level product for station 8518750 (The Battery, New York), read at deploy time without a key. One request covers the whole record, from January 1856 to December 2025, in metres against the station MSL datum, the mean of hourly heights over the 1983 to 2001 National Tidal Datum Epoch. The window ends with the last complete calendar year, so a year joins the record once December has closed it. The agency answers with a row for every month in the window and leaves the value blank when it has none; blank rows are dropped, and a year is averaged over the months it does have, which is why 1920 is an average of seven months and 1861 and 1879 to 1892 carry none at all. The trend is a least-squares fit through the annual means, in millimetres per year, and the 19 inches in the headline is the change between the 1856 and the 2025 annual means. If the download is slow or unreachable at build time the page falls back to the committed snapshot in apps/web/src/fixtures and says so in the build log.',
    references: [
      {
        label: 'Tides and Currents station 8518750, The Battery (NOAA CO-OPS)',
        url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8518750',
        kind: 'data',
      },
      {
        label: 'The monthly mean sea level request this site reads (NOAA CO-OPS)',
        url: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=monthly_mean&application=nzlab-usa-sources&begin_date=18560101&end_date=20251231&datum=MSL&station=8518750&time_zone=gmt&units=metric&format=json',
        kind: 'data',
      },
      {
        label: 'Relative sea level trends at US tide gauges (NOAA CO-OPS)',
        url: 'https://tidesandcurrents.noaa.gov/sltrends/',
        kind: 'data',
      },
      {
        label: 'Tidal datums and the National Tidal Datum Epoch (NOAA CO-OPS)',
        url: 'https://tidesandcurrents.noaa.gov/datum_options.html',
        kind: 'data',
      },
    ],
  },
  {
    slug: 'treasury-interest-rate',
    keyFacts: [
      'The file opens at 6.59 percent in January 2001, its highest month.',
      'The lowest month is 1.56 percent in January 2022, at the end of a twenty-year slide.',
      '28 months dipped below 2 percent, all of them between May 2020 and August 2022.',
      'The first ten years average 4.66 percent against 2.51 percent for the last ten.',
    ],
    howToRead:
      'The line is the average rate the whole debt carries, one point per month from January 2001 to the newest month the agency has published. The dashed line marks the lowest month in the file.',
    sourceUrl:
      'https://fiscaldata.treasury.gov/datasets/average-interest-rates-treasury-securities/',
    label: 'Treasury interest rate',
    eyebrow: 'the rate on the federal debt',
    title:
      'The average rate on the federal debt fell to 1.56 percent in 2022 and has climbed since.',
    description:
      'The Treasury publishes the average interest rate on the interest-bearing federal debt each month, back to January 2001. It ran from 6.59 percent that month down to 1.56 percent in January 2022, and has climbed since.',
    paragraphs: [
      'The number comes from the Bureau of the Fiscal Service, which divides the interest owed on the debt by the amount outstanding. Bills, notes, bonds, savings bonds, and the securities government trust funds hold all feed into that one figure. The agency leaves Treasury Inflation-Protected Securities and floating rate notes out of the total, so the rate describes the rest of the portfolio.',
      'The average moves slowly because most of the debt was issued years ago. A bill sold this month reprices at current rates, while a thirty-year bond sold in 2019 still pays the coupon it was issued with, and both sit in the same average. New debt arriving below the average pulls it down, which is what happened for twenty years: the rate ran from 6.59 percent in January 2001 to 1.56 percent in January 2022.',
      'The climb back has been quicker than the slide. The rate passed 3 percent again in October 2023, 21 months after the low, and every month since has stayed above 2 percent. It is still below where the file opens, 6.59 percent in January 2001, and a new month joins the file at the start of the month after the agency closes its books.',
    ],
    accent: 'emerald',
    dataSource: 'US Department of the Treasury',
    chartType: 'Line chart',
    category: 'Economy & business',
    dataNote:
      'Data: US Treasury Fiscal Data, the Average Interest Rates on U.S. Treasury Securities dataset (v2/accounting/od/avg_interest_rates), read at deploy time without a key. One request returns the whole published run, one row per month, filtered to security_type_desc "Interest-bearing Debt" and security_desc "Total Interest-bearing Debt", which is the portfolio total rather than the rate on the securities sold today. The agency calculates that total as aggregate interest payments divided by the total debt, and leaves Treasury Inflation-Protected Securities and floating rate notes out of it. The dataset is released monthly and each row is dated to the last day of its month, so the newest row is the last month the agency has closed. A row published without a value would be dropped rather than counted as zero. If the API is slow or unreachable at build time the page falls back to the committed snapshot in apps/web/src/fixtures and says so in the build log.',
    references: [
      {
        label: 'Average Interest Rates on U.S. Treasury Securities (US Treasury Fiscal Data)',
        url: 'https://fiscaldata.treasury.gov/datasets/average-interest-rates-treasury-securities/',
        kind: 'data',
      },
      {
        label: 'The API endpoint this site reads',
        url: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates',
        kind: 'data',
      },
      {
        label: 'Monthly Statement of the Public Debt (US Treasury Fiscal Data)',
        url: 'https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/',
        kind: 'data',
      },
      {
        label: 'Treasury marketable securities and how they are sold (TreasuryDirect)',
        url: 'https://www.treasurydirect.gov/marketable-securities/',
        kind: 'data',
      },
    ],
  },
  {
    slug: 'fema-disaster-declarations',
    keyFacts: [
      'Fire is the most common incident type in the file: 1,785 of the 5,272 declarations.',
      '2020 holds the single-year record at 315, and 165 of those are filed for COVID-19.',
      'March 2020 alone carries 142 declarations, more than any other month in the file.',
      'Fire Management, the program behind most fire records, begins in 2002 and holds 1,213 of them.',
      'California (397) and Texas (392) carry more declarations than any other state.',
    ],
    howToRead:
      'Each bar is one calendar year, the grey base is every other hazard and the indigo band on top is fire.',
    sourceUrl: 'https://www.fema.gov/openfema-data-page/fema-web-disaster-declarations-v1',
    label: 'FEMA declarations',
    eyebrow: 'FEMA disaster declarations',
    title:
      "Fire is the most common hazard in FEMA's disaster declarations, and 2020 was its busiest year.",
    description:
      'FEMA publishes one record for every disaster it declares, 5,272 of them since 1953. Fire leads the incident types at 1,785 declarations, and 2020 holds the single-year record at 315, with 165 filed for COVID-19.',
    paragraphs: [
      'The Federal Emergency Management Agency writes every declaration it makes into an open file, one row per declaration, and the rows run back to a tornado that hit Georgia in May 1953. A row names the program the declaration was made under, which is usually a Major Disaster or an Emergency, and the hazard behind it. This page counts those rows and splits each year into fire and everything else.',
      'Fire is the largest single hazard on the file. The 1950s and 1960s hold two and three fire records each, the 2000s hold 574, and fire has stayed near two fifths of the file since 1990. The Fire Management program behind most of those records arrives in 2002, the year the older Fire Suppression line ends, and it carries 1,213 fire declarations.',
      'The biggest spike in the file is the pandemic. FEMA made 315 declarations in 2020, and 165 of them are filed as a biological incident, each one titled COVID-19 Pandemic. March 2020 alone holds 142 of them, more than any other month in the file. The newest year is not finished: 2026 holds 133 declarations so far, and its bar on the chart fills as the agency publishes more.',
    ],
    accent: 'indigo',
    dataSource: 'Federal Emergency Management Agency (FEMA)',
    chartType: 'Bar chart',
    category: 'Society & community',
    dataNote:
      "Data: OpenFEMA, the Fema Web Disaster Declarations file (v1/FemaWebDisasterDeclarations), read at deploy time without a key. One request with an inline count covers the whole file, which holds one row per declaration from May 1953 to the newest declaration, sorted by the agency's own declaration number. A declaration is filed under one of four programs (Major Disaster, Emergency, Fire Management, or Fire Suppression) and one hazard, and the chart counts the hazard: rows whose incident type is Fire are the indigo band, everything else is the grey base. The newest year is a partial year, so its bar is short by construction and grows with each declaration the agency publishes. A response that answers with fewer rows than the agency's own count stops the build rather than charting a truncated file. If the endpoint is slow or unreachable at build time the page falls back to the committed snapshot in apps/web/src/fixtures and says so in the build log.",
    references: [
      {
        label: 'Fema Web Disaster Declarations, one row per declaration (FEMA OpenFEMA)',
        url: 'https://www.fema.gov/openfema-data-page/fema-web-disaster-declarations-v1',
        kind: 'data',
      },
      {
        label: 'The API endpoint this site reads',
        url: 'https://www.fema.gov/api/open/v1/FemaWebDisasterDeclarations',
        kind: 'data',
      },
      {
        label: 'Disaster Declarations Summaries, the county-level companion file (FEMA OpenFEMA)',
        url: 'https://www.fema.gov/openfema-data-page/disaster-declarations-summaries-v2',
        kind: 'data',
      },
      {
        label: "OpenFEMA, the agency's open data programme",
        url: 'https://www.fema.gov/about/reports-and-data/openfema',
        kind: 'data',
      },
    ],
  },
  {
    slug: 'fda-food-recalls',
    keyFacts: [
      '12,965 of the 29,463 recalls are Class I, 44 percent of the file.',
      '2017 was the busiest year at 3,203 recalls, 1,151 of them Class I.',
      'A firm recalled its own product in 29,060 of the 29,463 cases; the agency ordered 396.',
      'Class II, the grade for a problem that is usually reversible, covers 14,736 recalls.',
      'The file starts on 20 June 2012 and runs to 23 September 2026, the newest date the agency has published.',
    ],
    howToRead:
      'Each bar is one calendar year, the grey base is Class II and Class III and the lime band on top is Class I.',
    sourceUrl: 'https://open.fda.gov/apis/food/enforcement/',
    label: 'FDA food recalls',
    eyebrow: 'FDA food recalls',
    title: 'Class I covers 44 percent of the 29,463 food recalls FDA has published since 2012.',
    description:
      'The Food and Drug Administration posts every food recall it publishes to an open file: 29,463 of them since June 2012, and 12,965 are Class I, the grade for a product that can seriously harm or kill. Recalls peaked in 2017 at 3,203.',
    paragraphs: [
      'Every food recall the Food and Drug Administration publishes lands in the food part of openFDA, one record per recall. A record names the firm, the product, the reason it came off the shelf, and a class that says how dangerous the problem is. The file starts on 20 June 2012 and holds 29,463 recalls up to 23 September 2026.',
      'Class I means there is a reasonable chance the food will cause serious harm or death, and it covers 12,965 recalls, 44 percent of the file. Class II, where the harm is usually temporary and reversible, covers 14,736. Class III, where the food is unlikely to cause harm at all, covers 1,761.',
      "The count has moved a lot from year to year. It rose from 1,917 in 2012, a year that starts in June, to a peak of 3,203 in 2017, then fell to 1,181 in 2021. 2026 stands at 1,007 recalls up to 23 September, with the year still open. Nearly every recall is the firm's own decision: 29,060 of the 29,463, while the agency ordered 396.",
    ],
    accent: 'lime',
    dataSource: 'US Food and Drug Administration (FDA)',
    chartType: 'Bar chart',
    category: 'Agriculture & food',
    dataNote:
      'Data: openFDA, the food enforcement reports endpoint (api.fda.gov/food/enforcement.json), read at deploy time without a key. The endpoint answers one question per request, so the page reads five: the total record count, the recalls published on each date, the same dates filtered to Class I, the count per classification, and the count per initiator. A snapshot whose publication dates cover fewer recalls than the endpoint reports stops the build rather than charting a short file. The agency publishes enforcement reports on Wednesdays, so the newest date moves weekly; the newest year is a partial year and its bar grows with each publication. If the endpoint is slow or unreachable at build time the page falls back to the committed snapshot in apps/web/src/fixtures and says so in the build log.',
    references: [
      {
        label: 'openFDA food enforcement reports, one record per recall (FDA)',
        url: 'https://open.fda.gov/apis/food/enforcement/',
        kind: 'data',
      },
      {
        label: 'The API endpoint this site reads',
        url: 'https://api.fda.gov/food/enforcement.json?limit=1',
        kind: 'data',
      },
      {
        label: 'Recalls, market withdrawals, and safety alerts (FDA)',
        url: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
        kind: 'data',
      },
      {
        label: "openFDA, the agency's open data programme",
        url: 'https://open.fda.gov/',
        kind: 'data',
      },
    ],
  },
  {
    slug: 'mississippi-peak-flow',
    keyFacts: [
      'The record peak is 1,080,000 cubic feet per second on 1 August 1993.',
      '1903 comes second at 1,020,000, and 1844 third at 1,000,000.',
      'Five water years have reached 900,000: 1844, 1892, 1903, 1993, and 2019.',
      'The lowest peak on the record is 136,000 cubic feet per second in 1934, less than an eighth of the record.',
      'No peak was filed for the 17 water years from 1845 to 1861.',
    ],
    howToRead:
      'Each bar is one water year, drawn to the highest flow that year; the violet bars are the five years that reached 900,000 cubic feet per second, and the dashed line is the middle year.',
    sourceUrl: 'https://waterdata.usgs.gov/monitoring-location/USGS-07010000/',
    label: 'Mississippi peak flow',
    eyebrow: 'the Mississippi at St. Louis',
    title: 'The Mississippi at St. Louis peaked at 1.08 million cubic feet per second in 1993.',
    description:
      'The US Geological Survey has filed the highest flow of the year at St. Louis for 165 water years, starting in 1844. The record is 1,080,000 cubic feet per second on 1 August 1993, four other years have passed 900,000, and the lowest peak on the record is 136,000.',
    paragraphs: [
      'Every USGS stream gauge files the highest flow of the year, and the file at St. Louis runs from 1844. The gauge sits on the Mississippi just below the city, where the river drains 697,000 square miles of the basin above it, and it measures discharge in cubic feet per second: how much water moves past one point each second.',
      'The record is the flood of 1993, which crested at 1,080,000 cubic feet per second on 1 August. Two older floods sit close behind, at 1,020,000 in 1903 and 1,000,000 in 1844, and the 2019 flood is fourth at 941,000. Five water years in all have passed 900,000. The middle year of the 165 is 511,000, less than half the record, which is the shape of a river that spends most years well below its worst.',
      'Two things to read carefully. The record has a hole: no peak was filed for the 17 water years from 1845 to 1861, so the chart starts, stops, and starts again. And a peak is the highest single day of a year rather than the year as a whole, which is why a long, high-water season can rank below one sharp flood.',
    ],
    accent: 'violet',
    dataSource: 'US Geological Survey',
    chartType: 'Bar chart',
    category: 'Environment & geography',
    dataNote:
      'Data: USGS Water Data OGC API, the peaks collection (api.waterdata.usgs.gov/ogcapi/v0/collections/peaks/items), read at deploy time without a key. One request asks for monitoring location USGS-07010000 (the Mississippi River at St. Louis) and parameter 00060 (discharge), and returns the whole record, 165 rows, in one page. A peak is filed under the water year, which starts on 1 October, so a peak on 8 October 1955 is filed under water year 1956 and the chart follows the agency rather than the calendar. Years between 1845 and 1861 carry no row at all and are left as gaps rather than drawn as zero. Each row keeps the qualifiers the agency attached, such as UNKNOWNREGULATION where the agency could not tell whether works upstream changed the flow, or MAXDAILYMEAN where the peak is a daily mean rather than an instantaneous reading. If the endpoint is slow or unreachable at build time the page falls back to the committed snapshot in apps/web/src/fixtures and says so in the build log.',
    references: [
      {
        label: 'Peak-flow record and station details, Mississippi River at St. Louis (USGS)',
        url: 'https://waterdata.usgs.gov/monitoring-location/USGS-07010000/',
        kind: 'data',
      },
      {
        label: 'The peaks request this site reads (USGS Water Data OGC API)',
        url: 'https://api.waterdata.usgs.gov/ogcapi/v0/collections/peaks/items?monitoring_location_id=USGS-07010000&parameter_code=00060&limit=500',
        kind: 'data',
      },
      {
        label: 'USGS Water Services documentation',
        url: 'https://waterservices.usgs.gov/docs/',
        kind: 'data',
      },
      {
        label: 'USGS Water Data OGC API documentation',
        url: 'https://api.waterdata.usgs.gov/docs/',
        kind: 'data',
      },
    ],
  },
  {
    slug: 'cpsc-product-recalls',
    keyFacts: [
      '3,986 consumer product recalls were published between 2014 and 24 September 2026.',
      '2026 already holds 459 of them, more than any complete year in the window.',
      'The quietest year was 2021 at 219 recalls; the busiest complete year was 2025 at 420.',
      'China is named as a manufacturer country on 2,312 of the 3,986 recalls, 58 percent.',
      'A refund is the most common remedy, offered on 1,980 recalls, and a repair on 1,289.',
    ],
    howToRead:
      'Each bar counts the recalls the agency published in one calendar year, oldest first. The grey bar is 2026, which the agency is still filling, and the newest recall on the page is dated 24 September 2026.',
    sourceUrl: 'https://www.saferproducts.gov/RestWebServices/Recall',
    label: 'Product recalls',
    eyebrow: 'consumer product recalls',
    title: '459 consumer product recalls so far in 2026, more than any full year since 2014.',
    description:
      'The Consumer Product Safety Commission has published 3,986 consumer product recalls since 2014. The 2026 file already holds 459 of them through 24 September, more than any complete year in the window, and China is named as a manufacturer country on 2,312 of the recalls.',
    paragraphs: [
      'The Consumer Product Safety Commission writes every recall it publishes into an open file, one row per recall, and the same records run the public search at SaferProducts.gov. The file covers consumer products, so food sits in the FDA file, drugs in another, and vehicles with the traffic safety agency. Each row names the product, the hazard the agency found, the remedy offered, and the countries that made the product.',
      'The yearly count has moved a long way in thirteen years. It ran at 330 in 2016, fell to 219 in 2021, then climbed to 420 in 2025. Through 24 September 2026 it stands at 459, which is more than any complete year in the window, and the agency is still filing recalls for the year.',
      'China appears as a manufacturer country on 2,312 of the 3,986 recalls, 58 percent, and the United States on 753. 122 countries show up at least once. A recall can name several countries, so those counts add to more than the number of recalls.',
      'Read the count as recall records rather than products. One row can cover several products and any number of units, and a recall is dated to the day the agency published it. A refund is the most common remedy, offered on 1,980 recalls, with a repair on 1,289 and a replacement on 1,003.',
    ],
    accent: 'fuchsia',
    dataSource: 'Consumer Product Safety Commission (CPSC)',
    chartType: 'Bar chart',
    category: 'Society & community',
    dataNote:
      'Data: SaferProducts.gov recall service (www.saferproducts.gov/RestWebServices/Recall), read at deploy time without a key. One request answers for one calendar year, so the page makes 13 requests, for 2014 through 2026, and each response holds that year of recalls. A query wider than a year fails with a single row reading "Error retrieving Recalls: The underlying provider failed on Open.", which the reader turns into a fallback rather than a count. The 2026 row is partial: the file ends on 24 September 2026, so the busiest and quietest years the copy names are picked from the complete years. Manufacturer countries are counted per recall and overlap, so the country counts add to more than the number of recalls. The remedy option list is nearly an enum (Refund, Repair, Replace, Dispose, New Instructions, Label, Inspect) with two junk entries further down, one reading "R" and one repeating a recall paragraph; the chart lists the five options with the most recalls and leaves the tail out. If the service is slow or unreachable at build time the page falls back to the committed snapshot in apps/web/src/fixtures and says so in the build log.',
    references: [
      {
        label: 'SaferProducts.gov recall service, the endpoint this site reads (CPSC)',
        url: 'https://www.saferproducts.gov/RestWebServices/Recall',
        kind: 'data',
      },
      {
        label: "CPSC recalls, the agency's own recall list",
        url: 'https://www.cpsc.gov/Recalls',
        kind: 'data',
      },
      {
        label: 'SaferProducts.gov, the public recall search',
        url: 'https://www.saferproducts.gov/',
        kind: 'data',
      },
    ],
  },
  {
    slug: 'cfpb-consumer-complaints',
    keyFacts: [
      '2025 holds 5,442,963 complaints, close to twice the 2,734,268 filed in 2024.',
      'Complaints passed one million in a year for the first time in 2023, at 1,292,049.',
      'TransUnion, Equifax, and Experian are the companies named most often across the whole file.',
      'The database opened on 1 December 2011, and the 2011 bar on the chart covers that month alone.',
      'The 2026 file counted more complaints by 2 October than any full year before it.',
    ],
    howToRead:
      'Each bar counts the complaints the bureau sent to a company in one calendar year, oldest first; the grey bar is 2026, which is still being filled.',
    sourceUrl: 'https://www.consumerfinance.gov/data-research/consumer-complaints/',
    label: 'Consumer complaints',
    eyebrow: 'consumer complaints to the CFPB',
    title:
      'The CFPB counted 5.4 million consumer complaints in 2025, and 2026 passed that by October.',
    description:
      'The Consumer Financial Protection Bureau publishes every complaint it sends to a company. The file holds 5,442,963 complaints for 2025 against 2,734,268 for 2024, and the 2026 count passed last year by 2 October. TransUnion, Equifax, and Experian are the companies named most often.',
    paragraphs: [
      'The Consumer Financial Protection Bureau publishes every complaint it sends to a company, one row per complaint, and the rows run back to 1 December 2011. A row names the product, the issue, the company, the date the bureau received it, and how the company answered. This page counts those rows by the year they arrived.',
      'The count grew slowly for a decade and then took off. It passed a million for the first time in 2023, reached 2,734,268 in 2024, then 5,442,963 in 2025. By 2 October the 2026 file already held more complaints than any full year before it.',
      'Almost all of the growth sits in one place. Credit reporting is the product named in most complaints, and the three national credit bureaus, TransUnion, Equifax, and Experian, are the companies named most often across the file. A dispute with a credit report often reaches all three at once, because a person can file a separate complaint against each bureau, and every one of them becomes its own row.',
      'Two things about the numbers. A complaint is a description of a problem from one person, not a finding that the company did anything wrong, and the bureau publishes the company response beside it. And the file counts complaints rather than people: the newest days look thin because the bureau adds a complaint only after the company replies or after fifteen days, so the last rows are still arriving.',
    ],
    accent: 'purple',
    dataSource: 'Consumer Financial Protection Bureau (CFPB)',
    chartType: 'Bar chart',
    category: 'Economy & business',
    dataNote:
      'Data: the Consumer Complaint Database of the Consumer Financial Protection Bureau, read at deploy time from the search API at consumerfinance.gov without a key. The API answers one question per request, so the page reads one year of totals at a time, plus one request for the product and company tallies and one or two more to find the newest received day. The parameters size=0 and no_aggs=true keep a count request to about 15 KB rather than the roughly 400 KB the default aggregations add. The window starts in 2011 because the bureau published its first complaints on 1 December 2011, so that bar covers one month. The newest year is partial and its bar grows with each publication; a complaint enters the file after the company responds or after fifteen days. The company counts run across the whole window and overlap only in the sense that one person can file against several companies. If the API is slow or unreachable at build time the page falls back to the committed snapshot in apps/web/src/fixtures and says so in the build log.',
    references: [
      {
        label: 'Consumer Complaint Database, the public search (CFPB)',
        url: 'https://www.consumerfinance.gov/data-research/consumer-complaints/',
        kind: 'data',
      },
      {
        label: 'The search API endpoint this site reads (CFPB)',
        url: 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/',
        kind: 'data',
      },
      {
        label: 'How the bureau handles a complaint and when it publishes one (CFPB)',
        url: 'https://www.consumerfinance.gov/complaint/',
        kind: 'data',
      },
      {
        label: 'Consumer Complaint Database API documentation (CFPB)',
        url: 'https://cfpb.github.io/api/ccdb/',
        kind: 'data',
      },
    ],
  },
]);

/**
 * The microsites the site shows right now, in ship order. The lab publishes
 * one story at a time; the rest stay built, tested, and reachable behind
 * their own URLs.
 */
export const SHOWN_MICROSITES: MicrositeConfig[] = MICROSITES.filter((microsite) =>
  PUBLISHED_MICROSITES.includes(microsite.slug),
);
