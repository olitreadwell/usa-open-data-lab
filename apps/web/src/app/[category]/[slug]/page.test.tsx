import { renderToReadableStream } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CATEGORY_SLUGS, MICROSITES } from '@/lib/microsites';
import { PUBLISHED_MICROSITES } from '@/lib/published-microsites';

import MicrositePage, { generateMetadata } from './page';

/** True when this story is the one the site publishes right now. */
function isPublished(slug: string): boolean {
  return PUBLISHED_MICROSITES.includes(slug);
}

/** Builds the category/slug params for a microsite, or a miss for unknown slugs. */
function paramsFor(slug: string): { category: string; slug: string } {
  const microsite = MICROSITES.find((candidate) => candidate.slug === slug);
  return {
    category: microsite === undefined ? 'nope' : CATEGORY_SLUGS[microsite.category],
    slug,
  };
}

const notFoundMock = vi.fn();
vi.mock('next/navigation', () => ({
  notFound: (): never => {
    notFoundMock();
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/jobless-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/jobless-data')>();
  return {
    ...actual,
    fetchJoblessSeries: vi.fn().mockResolvedValue({
      points: [
        { label: 'Mar 2020', value: 4.4 },
        { label: 'Apr 2020', value: 14.8 },
        { label: 'Oct 2025', value: null },
      ],
      missingMonthLabels: ['Oct 2025'],
      latest: {
        seriesId: 'LNS14000000',
        year: 2025,
        period: 'M12',
        periodName: 'December',
        value: 4.4,
      },
      peak: {
        seriesId: 'LNS14000000',
        year: 2020,
        period: 'M04',
        periodName: 'April',
        value: 14.8,
      },
      lowest: {
        seriesId: 'LNS14000000',
        year: 2023,
        period: 'M04',
        periodName: 'April',
        value: 3.4,
      },
      changeFromPeak: -10.4,
      latestLabel: 'Dec 2025',
      peakLabel: 'Apr 2020',
      lowestLabel: 'Apr 2023',
    }),
  };
});

vi.mock('@/lib/hawaii-quakes-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hawaii-quakes-data')>();
  return {
    ...actual,
    fetchHawaiiQuakes: vi.fn().mockResolvedValue({
      bands: [
        { label: '2.5 up to 3.0', count: 176 },
        { label: '3.0 up to 3.5', count: 65 },
        { label: '3.5 up to 4.0', count: 18 },
        { label: '4.0 up to 4.5', count: 5 },
      ],
      count: 264,
      strongest: {
        id: 'hv74634117',
        magnitude: 4.41,
        place: '53 km W of Hawaiian Ocean View, Hawaii',
        timeMs: Date.UTC(2025, 2, 15),
        depthKm: 8.9,
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/hv74634117',
      },
      deepest: {
        id: 'hv74634000',
        magnitude: 3.1,
        place: '13 km W of Puako, Hawaii',
        timeMs: Date.UTC(2025, 1, 22),
        depthKm: 59.8,
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/hv74634000',
      },
      strongestLabel: '15 Mar 2025',
      deepestLabel: '22 Feb 2025',
      belowMagnitude3: 176,
    }),
  };
});

vi.mock('@/lib/cdc-obesity-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cdc-obesity-data')>();
  return {
    ...actual,
    fetchCdcObesityStory: vi.fn().mockResolvedValue({
      bands: [
        { label: '16%', rangeLabel: '16 up to 18 percent', lower: 16, upper: 18, count: 2 },
        { label: '36%', rangeLabel: '36 up to 38 percent', lower: 36, upper: 38, count: 514 },
        { label: '52%', rangeLabel: '52 up to 54 percent', lower: 52, upper: 54, count: 3 },
      ],
      countyCount: 2956,
      lowest: { countyName: 'Boulder', stateAbbr: 'CO', percent: 16.7, population: 326831 },
      highest: { countyName: 'Perry', stateAbbr: 'AL', percent: 52.9, population: 7738 },
      medianPercent: 37.9,
      weightedPercent: 33.28,
      nationalPercent: 32.8,
      aboveNationalCount: 2502,
      dataYear: 2023,
    }),
  };
});

vi.mock('@/lib/us-temperature-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/us-temperature-data')>();
  return {
    ...actual,
    fetchUsTemperatureStory: vi.fn().mockResolvedValue({
      points: [
        {
          year: 1895,
          valueFahrenheit: 50.33,
          decadeLabel: '1890s',
          changeFromTwentiethCentury: -1.68,
        },
        {
          year: 1917,
          valueFahrenheit: 50.05,
          decadeLabel: '1910s',
          changeFromTwentiethCentury: -1.96,
        },
        {
          year: 2025,
          valueFahrenheit: 54.62,
          decadeLabel: '2020s',
          changeFromTwentiethCentury: 2.61,
        },
      ],
      decadeLabels: ['1890s', '1910s', '2020s'],
      yearCount: 131,
      firstYear: 1895,
      lastYear: 2025,
      warmest: {
        year: 2024,
        valueFahrenheit: 55.48,
        decadeLabel: '2020s',
        changeFromTwentiethCentury: 3.47,
      },
      coldest: {
        year: 1917,
        valueFahrenheit: 50.05,
        decadeLabel: '1910s',
        changeFromTwentiethCentury: -1.96,
      },
      latest: {
        year: 2025,
        valueFahrenheit: 54.62,
        decadeLabel: '2020s',
        changeFromTwentiethCentury: 2.61,
      },
      latestChange: 2.61,
      twentiethCenturyMean: 52.01,
      recentYearCount: 26,
      recentAboveCount: 26,
    }),
  };
});

vi.mock('@/lib/sea-level-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sea-level-data')>();
  return {
    ...actual,
    fetchSeaLevelStory: vi.fn().mockResolvedValue({
      stationName: 'The Battery',
      points: [
        { year: 1856, meanSeaLevelMeters: -0.3635, monthCount: 12 },
        { year: 1920, meanSeaLevelMeters: -0.1463, monthCount: 7 },
        { year: 2025, meanSeaLevelMeters: 0.1179, monthCount: 12 },
      ],
      yearCount: 155,
      missingYearCount: 15,
      firstYear: { year: 1856, meanSeaLevelMeters: -0.3635, monthCount: 12 },
      lastYear: { year: 2025, meanSeaLevelMeters: 0.1179, monthCount: 12 },
      highest: { year: 2024, meanSeaLevelMeters: 0.1993, monthCount: 12 },
      lowest: { year: 1874, meanSeaLevelMeters: -0.3868, monthCount: 12 },
      riseMeters: 0.4814,
      riseInches: 18.95,
      trendMillimetresPerYear: 2.9473,
      trendStartMeters: -0.3934,
      trendEndMeters: 0.1047,
      highestYearsStartYear: 2010,
    }),
  };
});

vi.mock('@/lib/treasury-rate-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/treasury-rate-data')>();
  return {
    ...actual,
    fetchTreasuryRateStory: vi.fn().mockResolvedValue({
      points: [
        { label: 'Jan 2001', ratePercent: 6.594 },
        { label: 'Jan 2022', ratePercent: 1.556 },
        { label: 'Aug 2026', ratePercent: 3.49 },
      ],
      monthCount: 308,
      first: { label: 'Jan 2001', ratePercent: 6.594 },
      latest: { label: 'Aug 2026', ratePercent: 3.49 },
      highest: { label: 'Jan 2001', ratePercent: 6.594 },
      lowest: { label: 'Jan 2022', ratePercent: 1.556 },
      changeSinceLow: 1.934,
      highestSince: { label: 'May 2009', ratePercent: 3.524 },
      belowRateCount: 28,
      belowRateFirst: { label: 'May 2020', ratePercent: 1.842 },
      belowRateLast: { label: 'Aug 2022', ratePercent: 1.976 },
      firstDecadeMean: 4.656,
      recentDecadeMean: 2.51,
    }),
  };
});

vi.mock('@/lib/cpsc-recall-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cpsc-recall-data')>();
  return {
    ...actual,
    fetchCpscProductRecallStory: vi.fn().mockResolvedValue({
      bars: [
        { year: 2014, label: '2014', recallCount: 296, partial: false },
        { year: 2025, label: '2025', recallCount: 420, partial: false },
        { year: 2026, label: '2026', recallCount: 459, partial: true },
      ],
      totalRecalls: 3986,
      firstYear: 2014,
      newestYear: 2026,
      newestYearCount: 459,
      newestRecallDateLabel: '24 September 2026',
      busiestCompleteYear: { year: 2025, recallCount: 420 },
      quietestCompleteYear: { year: 2021, recallCount: 219 },
      remedies: [
        { option: 'Refund', recallCount: 1980, sharePercent: 49.7 },
        { option: 'Repair', recallCount: 1289, sharePercent: 32.3 },
        { option: 'Replace', recallCount: 1003, sharePercent: 25.2 },
        { option: 'Dispose', recallCount: 22, sharePercent: 0.6 },
        { option: 'New Instructions', recallCount: 20, sharePercent: 0.5 },
      ],
      refundCount: 1980,
      repairCount: 1289,
      topCountryCount: 2312,
      topCountrySharePercent: 58.0,
      countryCount: 122,
    }),
  };
});

vi.mock('@/lib/cfpb-complaints-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cfpb-complaints-data')>();
  return {
    ...actual,
    fetchCfpConsumerComplaintStory: vi.fn().mockResolvedValue({
      bars: [
        { year: 2011, label: '2011', complaintCount: 2536, partial: false },
        { year: 2025, label: '2025', complaintCount: 5442963, partial: false },
        { year: 2026, label: '2026', complaintCount: 5462631, partial: true },
      ],
      totalComplaints: 18145013,
      firstYear: 2011,
      newestYear: 2026,
      newestYearCount: 5462631,
      newestReceivedDateLabel: '2 October 2026',
      busiestCompleteYear: { year: 2025, complaintCount: 5442963 },
      companies: [
        {
          company: 'TRANSUNION INTERMEDIATE HOLDINGS, INC.',
          complaintCount: 5015681,
          sharePercent: 27.6,
        },
        { company: 'EQUIFAX, INC.', complaintCount: 4815296, sharePercent: 26.5 },
        {
          company: 'Experian Information Solutions Inc.',
          complaintCount: 4396123,
          sharePercent: 24.2,
        },
      ],
      topCompanyName: 'TRANSUNION INTERMEDIATE HOLDINGS, INC.',
      topCompanyCount: 5015681,
      topThreeCount: 14227100,
      topThreeSharePercent: 78.4,
    }),
  };
});

vi.mock('@/lib/fema-declarations-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/fema-declarations-data')>();
  return {
    ...actual,
    fetchFemaDeclarationStory: vi.fn().mockResolvedValue({
      bars: [
        { year: 1953, label: '1953', fire: 2, other: 92, total: 94 },
        { year: 2020, label: '2020', fire: 82, other: 233, total: 315 },
        { year: 2026, label: '2026', fire: 66, other: 67, total: 133 },
      ],
      declarationCount: 5272,
      firstYear: 1953,
      newestYear: 2026,
      newestYearCount: 133,
      fireCount: 1785,
      fireSharePercent: 33.86,
      busiestYear: { year: 2020, total: 315, fire: 82 },
      busiestMonthLabel: 'Mar 2020',
      busiestMonthCount: 142,
      covidCount: 165,
      fireManagementCount: 1213,
      fireManagementFirstYear: 2002,
      topStates: [
        { stateCode: 'CA', stateName: 'California', count: 397 },
        { stateCode: 'TX', stateName: 'Texas', count: 392 },
      ],
      decadeFireShare: [
        { decade: 1950, total: 94, fire: 2 },
        { decade: 2020, total: 1073, fire: 400 },
      ],
    }),
  };
});

vi.mock('@/lib/food-recalls-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/food-recalls-data')>();
  return {
    ...actual,
    fetchFoodRecallStory: vi.fn().mockResolvedValue({
      bars: [
        { year: 2012, label: '2012', classOne: 1053, other: 864, total: 1917 },
        { year: 2017, label: '2017', classOne: 1151, other: 2052, total: 3203 },
        { year: 2026, label: '2026', classOne: 366, other: 641, total: 1007 },
      ],
      recallCount: 29463,
      classOneCount: 12965,
      classOneSharePercent: 44.0,
      classCounts: [
        { name: 'Class II', count: 14736, sharePercent: 50.0 },
        { name: 'Class I', count: 12965, sharePercent: 44.0 },
        { name: 'Class III', count: 1761, sharePercent: 6.0 },
      ],
      firstReportDateLabel: '20 June 2012',
      newestReportDateLabel: '23 September 2026',
      firstYear: 2012,
      newestYear: 2026,
      newestYearCount: 1007,
      firstYearCount: 1917,
      busiestYear: { year: 2017, total: 3203, classOne: 1151, other: 2052 },
      voluntaryCount: 29060,
      voluntarySharePercent: 98.6,
      mandatedCount: 396,
    }),
  };
});

vi.mock('@/lib/peak-streamflow-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/peak-streamflow-data')>();
  return {
    ...actual,
    fetchPeakStreamflowStory: vi.fn().mockResolvedValue({
      bars: [
        {
          waterYear: 1844,
          label: '1844',
          peakDate: '1844-06-27',
          peakDateLabel: '27 June 1844',
          dischargeCubicFeetPerSecond: 1000000,
        },
        {
          waterYear: 1993,
          label: '1993',
          peakDate: '1993-08-01',
          peakDateLabel: '1 August 1993',
          dischargeCubicFeetPerSecond: 1080000,
        },
        {
          waterYear: 2025,
          label: '2025',
          peakDate: '2025-07-30',
          peakDateLabel: '30 July 2025',
          dischargeCubicFeetPerSecond: 378000,
        },
      ],
      yearCount: 165,
      firstWaterYear: 1844,
      lastWaterYear: 2025,
      record: {
        waterYear: 1993,
        label: '1993',
        peakDate: '1993-08-01',
        peakDateLabel: '1 August 1993',
        dischargeCubicFeetPerSecond: 1080000,
      },
      runnerUp: {
        waterYear: 1903,
        label: '1903',
        peakDate: '1903-06-10',
        peakDateLabel: '10 June 1903',
        dischargeCubicFeetPerSecond: 1020000,
      },
      lowest: {
        waterYear: 1934,
        label: '1934',
        peakDate: '1934-04-24',
        peakDateLabel: '24 April 1934',
        dischargeCubicFeetPerSecond: 136000,
      },
      latest: {
        waterYear: 2025,
        label: '2025',
        peakDate: '2025-07-30',
        peakDateLabel: '30 July 2025',
        dischargeCubicFeetPerSecond: 378000,
      },
      medianDischargeCubicFeetPerSecond: 511000,
      missingWaterYears: [1845, 1861],
      missingYearCount: 17,
      bigPeakYears: [1844, 1892, 1903, 1993, 2019],
    }),
  };
});

describe('MicrositePage', () => {
  it.skipIf(!isPublished('fda-food-recalls'))(
    'renders the fda-food-recalls story with its chart, stat cards, and sources',
    async () => {
      const stream = await renderToReadableStream(
        <MicrositePage params={Promise.resolve(paramsFor('fda-food-recalls'))} />,
      );
      const html = await new Response(stream).text();
      expect(html).toContain('Class I covers 44 percent of the 29,463 food recalls');
      expect(html).toContain('href="/agriculture"');
      expect(html).toContain('29,463');
      expect(html).toContain('Busiest year, 2017');
      expect(html).toContain('12,965');
      expect(html).toContain('openFDA food enforcement reports, one record per recall (FDA)');
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
    },
  );

  it.skipIf(!isPublished('fda-food-recalls'))(
    'returns a unique document title for the fda-food-recalls microsite',
    async () => {
      await expect(
        generateMetadata({ params: Promise.resolve(paramsFor('fda-food-recalls')) }),
      ).resolves.toEqual({
        title: 'FDA food recalls - usa-open-data-lab',
        description: expect.any(String),
        openGraph: {
          title: 'FDA food recalls - usa-open-data-lab',
          description: expect.any(String),
          url: '/agriculture/fda-food-recalls/',
          type: 'article',
        },
      });
    },
  );

  it('renders the jobless-rate story with narrative, chart, and sources', async () => {
    const stream = await renderToReadableStream(
      <MicrositePage params={Promise.resolve(paramsFor('jobless-rate'))} />,
    );
    const html = await new Response(stream).text();
    expect(html).toContain('peaked at 14.8 percent in April 2020');
    expect(html).toContain('October 2025 is empty');
    expect(html).toContain('Key facts');
    expect(html).toContain('How to read this chart');
    expect(html).toContain('Open source data');
    expect(html).toContain('Sources and further reading');
    expect(html).toContain('Unemployment rate, series LNS14000000');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/economy"');
    expect(html).toContain('Jobless rate');
    expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
  });

  it('reads the headline numbers out of the series', async () => {
    const stream = await renderToReadableStream(
      <MicrositePage params={Promise.resolve(paramsFor('jobless-rate'))} />,
    );
    const html = await new Response(stream).text();
    expect(html).toContain('4.4%');
    expect(html).toContain('14.8%');
    expect(html).toContain('-10.4 pts');
  });

  it('renders exactly one h1 with the microsite title before any h2', async () => {
    const stream = await renderToReadableStream(
      <MicrositePage params={Promise.resolve(paramsFor('jobless-rate'))} />,
    );
    const html = await new Response(stream).text();
    const h1s = html.match(/<h1[^>]*>(.*?)<\/h1>/g) ?? [];
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toContain('peaked at 14.8 percent in April 2020');
    const headingIndexes = ['<h1', '<h2', '<h3', '<h4', '<h5', '<h6']
      .map((tag) => html.indexOf(tag))
      .filter((index) => index !== -1);
    expect(Math.min(...headingIndexes)).toBe(html.indexOf('<h1'));
  });

  it('returns a unique document title for the jobless-rate microsite', async () => {
    await expect(
      generateMetadata({ params: Promise.resolve(paramsFor('jobless-rate')) }),
    ).resolves.toEqual({
      title: 'Jobless rate - usa-open-data-lab',
      description: expect.any(String),
      openGraph: {
        title: 'Jobless rate - usa-open-data-lab',
        description: expect.any(String),
        url: '/economy/jobless-rate/',
        type: 'article',
      },
    });
  });

  it.skipIf(!isPublished('nope'))('returns a generic title for an unknown microsite', async () => {
    await expect(generateMetadata({ params: Promise.resolve(paramsFor('nope')) })).resolves.toEqual(
      {
        title: 'usa-open-data-lab',
      },
    );
  });

  it.skipIf(!isPublished('hawaii-quakes'))(
    'renders the hawaii-quakes story with its chart, stat cards, and sources',
    async () => {
      const stream = await renderToReadableStream(
        <MicrositePage params={Promise.resolve(paramsFor('hawaii-quakes'))} />,
      );
      const html = await new Response(stream).text();
      expect(html).toContain('two thirds were below magnitude 3');
      expect(html).toContain('href="/environment"');
      expect(html).toContain('264');
      expect(html).toContain('M4.41');
      expect(html).toContain('Strongest, 15 Mar 2025');
      expect(html).toContain('USGS earthquake catalogue, FDSN event query');
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
    },
  );

  it.skipIf(!isPublished('hawaii-quakes'))(
    'returns a unique document title for the hawaii-quakes microsite',
    async () => {
      await expect(
        generateMetadata({ params: Promise.resolve(paramsFor('hawaii-quakes')) }),
      ).resolves.toEqual({
        title: 'Hawaii earthquakes - usa-open-data-lab',
        description: expect.any(String),
        openGraph: {
          title: 'Hawaii earthquakes - usa-open-data-lab',
          description: expect.any(String),
          url: '/environment/hawaii-quakes/',
          type: 'article',
        },
      });
    },
  );

  it.skipIf(!isPublished('cdc-county-obesity'))(
    'renders the cdc-county-obesity story with its chart, stat cards, and sources',
    async () => {
      const stream = await renderToReadableStream(
        <MicrositePage params={Promise.resolve(paramsFor('cdc-county-obesity'))} />,
      );
      const html = await new Response(stream).text();
      expect(html).toContain('runs from 16.7 percent to 52.9 percent');
      expect(html).toContain('href="/health"');
      expect(html).toContain('2,956');
      expect(html).toContain('37.9%');
      expect(html).toContain('Counties above 32.8%');
      expect(html).toContain(
        'PLACES: Local Data for Better Health, county data, 2025 release (CDC)',
      );
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
    },
  );

  it.skipIf(!isPublished('cdc-county-obesity'))(
    'returns a unique document title for the cdc-county-obesity microsite',
    async () => {
      await expect(
        generateMetadata({ params: Promise.resolve(paramsFor('cdc-county-obesity')) }),
      ).resolves.toEqual({
        title: 'County obesity - usa-open-data-lab',
        description: expect.any(String),
        openGraph: {
          title: 'County obesity - usa-open-data-lab',
          description: expect.any(String),
          url: '/health/cdc-county-obesity/',
          type: 'article',
        },
      });
    },
  );
  it.skipIf(!isPublished('us-temperature-record'))(
    'renders the us-temperature-record story with its chart, stat cards, and sources',
    async () => {
      const stream = await renderToReadableStream(
        <MicrositePage params={Promise.resolve(paramsFor('us-temperature-record'))} />,
      );
      const html = await new Response(stream).text();
      expect(html).toContain('Every year since 2000 has run warmer than the 20th century average');
      expect(html).toContain('href="/energy"');
      expect(html).toContain('55.48 °F');
      expect(html).toContain('+2.61 °F');
      expect(html).toContain('26 of 26');
      expect(html).toContain('Climate at a Glance (NOAA NCEI)');
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
    },
  );

  it.skipIf(!isPublished('us-temperature-record'))(
    'returns a unique document title for the us-temperature-record microsite',
    async () => {
      await expect(
        generateMetadata({ params: Promise.resolve(paramsFor('us-temperature-record')) }),
      ).resolves.toEqual({
        title: 'US temperature record - usa-open-data-lab',
        description: expect.any(String),
        openGraph: {
          title: 'US temperature record - usa-open-data-lab',
          description: expect.any(String),
          url: '/energy/us-temperature-record/',
          type: 'article',
        },
      });
    },
  );

  it.skipIf(!isPublished('battery-sea-level'))(
    'renders the battery-sea-level story with its chart, stat cards, and sources',
    async () => {
      const stream = await renderToReadableStream(
        <MicrositePage params={Promise.resolve(paramsFor('battery-sea-level'))} />,
      );
      const html = await new Response(stream).text();
      expect(html).toContain('has risen 19 inches since 1856');
      expect(html).toContain('href="/environment"');
      expect(html).toContain('+0.48 m');
      expect(html).toContain('+0.12 m');
      expect(html).toContain('2.95 mm a year');
      expect(html).toContain('Tides and Currents station 8518750, The Battery (NOAA CO-OPS)');
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
    },
  );

  it.skipIf(!isPublished('battery-sea-level'))(
    'returns a unique document title for the battery-sea-level microsite',
    async () => {
      await expect(
        generateMetadata({ params: Promise.resolve(paramsFor('battery-sea-level')) }),
      ).resolves.toEqual({
        title: 'Battery sea level - usa-open-data-lab',
        description: expect.any(String),
        openGraph: {
          title: 'Battery sea level - usa-open-data-lab',
          description: expect.any(String),
          url: '/environment/battery-sea-level/',
          type: 'article',
        },
      });
    },
  );

  it.skipIf(!isPublished('treasury-interest-rate'))(
    'renders the treasury-interest-rate story with its chart, stat cards, and sources',
    async () => {
      const stream = await renderToReadableStream(
        <MicrositePage params={Promise.resolve(paramsFor('treasury-interest-rate'))} />,
      );
      const html = await new Response(stream).text();
      expect(html).toContain('fell to 1.56 percent in 2022 and has climbed since');
      expect(html).toContain('href="/economy"');
      expect(html).toContain('Rate in Aug 2026');
      expect(html).toContain('3.49%');
      expect(html).toContain('1.56%');
      expect(html).toContain('+1.9 pts');
      expect(html).toContain(
        'Average Interest Rates on U.S. Treasury Securities (US Treasury Fiscal Data)',
      );
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
    },
  );

  it.skipIf(!isPublished('fema-disaster-declarations'))(
    'renders the fema-disaster-declarations story with its chart, stat cards, and sources',
    async () => {
      const stream = await renderToReadableStream(
        <MicrositePage params={Promise.resolve(paramsFor('fema-disaster-declarations'))} />,
      );
      const html = await new Response(stream).text();
      expect(html).toContain('Fire is the most common hazard in FEMA&#x27;s disaster declarations');
      expect(html).toContain('href="/society"');
      expect(html).toContain('5,272');
      expect(html).toContain('Busiest year, 2020');
      expect(html).toContain('1,785');
      expect(html).toContain(
        'Fema Web Disaster Declarations, one row per declaration (FEMA OpenFEMA)',
      );
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
    },
  );

  it.skipIf(!isPublished('fema-disaster-declarations'))(
    'returns a unique document title for the fema-disaster-declarations microsite',
    async () => {
      await expect(
        generateMetadata({ params: Promise.resolve(paramsFor('fema-disaster-declarations')) }),
      ).resolves.toEqual({
        title: 'FEMA declarations - usa-open-data-lab',
        description: expect.any(String),
        openGraph: {
          title: 'FEMA declarations - usa-open-data-lab',
          description: expect.any(String),
          url: '/society/fema-disaster-declarations/',
          type: 'article',
        },
      });
    },
  );

  it.skipIf(!isPublished('mississippi-peak-flow'))(
    'renders the mississippi-peak-flow story with its chart, stat cards, and sources',
    async () => {
      const stream = await renderToReadableStream(
        <MicrositePage params={Promise.resolve(paramsFor('mississippi-peak-flow'))} />,
      );
      const html = await new Response(stream).text();
      expect(html).toContain(
        'The Mississippi at St. Louis peaked at 1.08 million cubic feet per second in 1993.',
      );
      expect(html).toContain('href="/environment"');
      expect(html).toContain('Record peak, 1 August 1993');
      expect(html).toContain('1,080,000 cfs');
      expect(html).toContain('5 of 165');
      expect(html).toContain(
        'Peak-flow record and station details, Mississippi River at St. Louis',
      );
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
    },
  );

  it.skipIf(!isPublished('cpsc-product-recalls'))(
    'renders the cpsc-product-recalls story with its chart, stat cards, and sources',
    async () => {
      const stream = await renderToReadableStream(
        <MicrositePage params={Promise.resolve(paramsFor('cpsc-product-recalls'))} />,
      );
      const html = await new Response(stream).text();
      expect(html).toContain(
        '459 consumer product recalls so far in 2026, more than any full year since 2014.',
      );
      expect(html).toContain('href="/society"');
      expect(html).toContain('Recalls since 2014');
      expect(html).toContain('3,986');
      expect(html).toContain('459');
      expect(html).toContain('Recalls naming China');
      expect(html).toContain('2,312');
      expect(html).toContain('Remedy options');
      expect(html).toContain('1,980');
      expect(html).toContain(
        'SaferProducts.gov recall service, the endpoint this site reads (CPSC)',
      );
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
    },
  );

  it.skipIf(!isPublished('cpsc-product-recalls'))(
    'returns a unique document title for the cpsc-product-recalls microsite',
    async () => {
      await expect(
        generateMetadata({ params: Promise.resolve(paramsFor('cpsc-product-recalls')) }),
      ).resolves.toEqual({
        title: 'Product recalls - usa-open-data-lab',
        description: expect.any(String),
        openGraph: {
          title: 'Product recalls - usa-open-data-lab',
          description: expect.any(String),
          url: '/society/cpsc-product-recalls/',
          type: 'article',
        },
      });
    },
  );

  it.skipIf(!isPublished('cfpb-consumer-complaints'))(
    'renders the cfpb-consumer-complaints story with its chart, stat cards, and sources',
    async () => {
      const stream = await renderToReadableStream(
        <MicrositePage params={Promise.resolve(paramsFor('cfpb-consumer-complaints'))} />,
      );
      const html = await new Response(stream).text();
      expect(html).toContain(
        'The CFPB counted 5.4 million consumer complaints in 2025, and 2026 passed that by October.',
      );
      expect(html).toContain('href="/economy"');
      expect(html).toContain('Complaints in the file');
      expect(html).toContain('18,145,013');
      expect(html).toContain('2026 so far');
      expect(html).toContain('5,462,631');
      expect(html).toContain('Complaints naming the three bureaus');
      expect(html).toContain('14,227,100');
      expect(html).toContain('The companies named most often');
      expect(html).toContain('TRANSUNION INTERMEDIATE HOLDINGS, INC.');
      expect(html).toContain('The search API endpoint this site reads (CFPB)');
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html.match(/<h1[^>]*>/g) ?? []).toHaveLength(1);
    },
  );

  it.skipIf(!isPublished('cfpb-consumer-complaints'))(
    'returns a unique document title for the cfpb-consumer-complaints microsite',
    async () => {
      await expect(
        generateMetadata({ params: Promise.resolve(paramsFor('cfpb-consumer-complaints')) }),
      ).resolves.toEqual({
        title: 'Consumer complaints - usa-open-data-lab',
        description: expect.any(String),
        openGraph: {
          title: 'Consumer complaints - usa-open-data-lab',
          description: expect.any(String),
          url: '/economy/cfpb-consumer-complaints/',
          type: 'article',
        },
      });
    },
  );

  it.skipIf(!isPublished('mississippi-peak-flow'))(
    'returns a unique document title for the mississippi-peak-flow microsite',
    async () => {
      await expect(
        generateMetadata({ params: Promise.resolve(paramsFor('mississippi-peak-flow')) }),
      ).resolves.toEqual({
        title: 'Mississippi peak flow - usa-open-data-lab',
        description: expect.any(String),
        openGraph: {
          title: 'Mississippi peak flow - usa-open-data-lab',
          description: expect.any(String),
          url: '/environment/mississippi-peak-flow/',
          type: 'article',
        },
      });
    },
  );

  it.skipIf(!isPublished('treasury-interest-rate'))(
    'returns a unique document title for the treasury-interest-rate microsite',
    async () => {
      await expect(
        generateMetadata({ params: Promise.resolve(paramsFor('treasury-interest-rate')) }),
      ).resolves.toEqual({
        title: 'Treasury interest rate - usa-open-data-lab',
        description: expect.any(String),
        openGraph: {
          title: 'Treasury interest rate - usa-open-data-lab',
          description: expect.any(String),
          url: '/economy/treasury-interest-rate/',
          type: 'article',
        },
      });
    },
  );
});
