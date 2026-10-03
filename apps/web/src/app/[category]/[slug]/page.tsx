import { Container } from '@usa-open-data-lab/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CdcObesityChart } from '@/components/CdcObesityChart';
import { CfpbComplaintsChart } from '@/components/CfpbComplaintsChart';
import { CpscRecallsChart } from '@/components/CpscRecallsChart';
import { FemaDeclarationsChart } from '@/components/FemaDeclarationsChart';
import { FoodRecallsChart } from '@/components/FoodRecallsChart';
import { HawaiiQuakesChart } from '@/components/HawaiiQuakesChart';
import { JoblessChart } from '@/components/JoblessChart';
import { MicrositeStory } from '@/components/MicrositeStory';
import { PeakStreamflowChart } from '@/components/PeakStreamflowChart';
import { ReportIssueButton } from '@/components/ReportIssueButton';
import { SeaLevelDotPlot } from '@/components/SeaLevelDotPlot';
import { StatCard } from '@/components/StatCard';
import { TreasuryRateChart } from '@/components/TreasuryRateChart';
import { UsTemperatureStripChart } from '@/components/UsTemperatureStripChart';
import {
  bandLabelForPercent,
  type CdcObesityStory,
  fetchCdcObesityStory,
} from '@/lib/cdc-obesity-data';
import {
  type CfpConsumerComplaintStory,
  fetchCfpConsumerComplaintStory,
} from '@/lib/cfpb-complaints-data';
import { type CpscProductRecallStory, fetchCpscProductRecallStory } from '@/lib/cpsc-recall-data';
import { type FemaDeclarationStory, fetchFemaDeclarationStory } from '@/lib/fema-declarations-data';
import { fetchFoodRecallStory, type FoodRecallStory } from '@/lib/food-recalls-data';
import { fetchHawaiiQuakes, type HawaiiQuakeStory } from '@/lib/hawaii-quakes-data';
import { fetchJoblessSeries, type JoblessSeries } from '@/lib/jobless-data';
import {
  categorySlugFor,
  freshnessLabelFor,
  micrositePathFor,
  MICROSITES,
  relatedMicrositesFor,
} from '@/lib/microsites';
import {
  BIG_PEAK_CUBIC_FEET_PER_SECOND,
  fetchPeakStreamflowStory,
  type PeakStreamflowStory,
} from '@/lib/peak-streamflow-data';
import { fetchSeaLevelStory, type SeaLevelStory } from '@/lib/sea-level-data';
import { fetchTreasuryRateStory, type TreasuryRateStory } from '@/lib/treasury-rate-data';
import {
  formatCount,
  formatDischargeCubicFeetPerSecond,
  formatFahrenheit,
  formatFahrenheitChange,
  formatMagnitude,
  formatMetresChange,
  formatMillimetresPerYear,
  formatPercent,
  formatPercentTwoDecimals,
  formatPointChange,
} from '@/lib/us-format';
import { fetchUsTemperatureStory, type UsTemperatureStory } from '@/lib/us-temperature-data';

interface MicrositePageProps {
  params: Promise<{ category: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams(): { category: string; slug: string }[] {
  return MICROSITES.map((microsite) => ({
    category: categorySlugFor(microsite),
    slug: microsite.slug,
  }));
}

export async function generateMetadata({ params }: MicrositePageProps): Promise<Metadata> {
  const { category, slug } = await params;
  const microsite = MICROSITES.find((candidate) => candidate.slug === slug);
  if (microsite === undefined || categorySlugFor(microsite) !== category) {
    return { title: 'usa-open-data-lab' };
  }
  const path = micrositePathFor(microsite);
  return {
    title: `${microsite.label} - usa-open-data-lab`,
    description: microsite.description,
    openGraph: {
      title: `${microsite.label} - usa-open-data-lab`,
      description: microsite.description,
      url: path,
      type: 'article',
    },
  };
}

export default async function MicrositePage({
  params,
}: MicrositePageProps): Promise<React.ReactElement> {
  const { category, slug } = await params;
  const microsite = MICROSITES.find((candidate) => candidate.slug === slug);
  if (microsite === undefined || categorySlugFor(microsite) !== category) {
    notFound();
  }

  const related = relatedMicrositesFor(microsite).map((candidate) => ({
    label: candidate.label,
    href: micrositePathFor(candidate),
  }));

  const content = renderStoryContent(slug, await loadStoryData(slug));

  return (
    <>
      <Container size="wide">
        <nav aria-label="Breadcrumb" className="py-[var(--spacing-2xl)]">
          <ol className="numeral-paragraph-sm flex flex-wrap items-center gap-2 text-[var(--color-muted)]">
            <li>
              <Link href="/" className="underline hover:text-[var(--color-fg)]">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href={`/${categorySlugFor(microsite)}/`}
                className="underline hover:text-[var(--color-fg)]"
              >
                {microsite.category}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[var(--color-fg)]">
              {microsite.label}
            </li>
          </ol>
        </nav>
      </Container>
      <MicrositeStory
        id={microsite.slug}
        eyebrow={microsite.eyebrow}
        title={microsite.title}
        description={microsite.description}
        paragraphs={microsite.paragraphs}
        keyFacts={microsite.keyFacts}
        howToRead={microsite.howToRead}
        sourceUrl={microsite.sourceUrl}
        updatedLabel={freshnessLabelFor(microsite)}
        related={related}
        accent={microsite.accent}
        chart={content.chart}
        stats={content.stats}
        dataNote={microsite.dataNote}
        references={microsite.references}
      />
      <ReportIssueButton pageLabel={microsite.label} />
    </>
  );
}

interface StoryData {
  jobless: JoblessSeries | null;
  hawaii: HawaiiQuakeStory | null;
  obesity: CdcObesityStory | null;
  temperature: UsTemperatureStory | null;
  seaLevel: SeaLevelStory | null;
  treasuryRate: TreasuryRateStory | null;
  fema: FemaDeclarationStory | null;
  foodRecalls: FoodRecallStory | null;
  peakStreamflow: PeakStreamflowStory | null;
  cpsc: CpscProductRecallStory | null;
  cfpb: CfpConsumerComplaintStory | null;
}

/**
 * Reads the data one story needs from its own source.
 *
 * Each microsite fetches only what it renders, so a source that is slow or
 * unreachable cannot hold up a page that does not use it.
 *
 * @param slug - the microsite slug
 * @returns the story's data, with the other story's slot left empty
 */
async function loadStoryData(slug: string): Promise<StoryData> {
  if (slug === 'hawaii-quakes') {
    return {
      jobless: null,
      hawaii: await fetchHawaiiQuakes(),
      obesity: null,
      temperature: null,
      seaLevel: null,
      treasuryRate: null,
      fema: null,
      foodRecalls: null,
      peakStreamflow: null,
      cpsc: null,
      cfpb: null,
    };
  }
  if (slug === 'cdc-county-obesity') {
    return {
      jobless: null,
      hawaii: null,
      obesity: await fetchCdcObesityStory(),
      temperature: null,
      seaLevel: null,
      treasuryRate: null,
      fema: null,
      foodRecalls: null,
      peakStreamflow: null,
      cpsc: null,
      cfpb: null,
    };
  }
  if (slug === 'us-temperature-record') {
    return {
      jobless: null,
      hawaii: null,
      obesity: null,
      temperature: await fetchUsTemperatureStory(),
      seaLevel: null,
      treasuryRate: null,
      fema: null,
      foodRecalls: null,
      peakStreamflow: null,
      cpsc: null,
      cfpb: null,
    };
  }
  if (slug === 'battery-sea-level') {
    return {
      jobless: null,
      hawaii: null,
      obesity: null,
      temperature: null,
      seaLevel: await fetchSeaLevelStory(),
      treasuryRate: null,
      fema: null,
      foodRecalls: null,
      peakStreamflow: null,
      cpsc: null,
      cfpb: null,
    };
  }
  if (slug === 'treasury-interest-rate') {
    return {
      jobless: null,
      hawaii: null,
      obesity: null,
      temperature: null,
      seaLevel: null,
      treasuryRate: await fetchTreasuryRateStory(),
      fema: null,
      foodRecalls: null,
      peakStreamflow: null,
      cpsc: null,
      cfpb: null,
    };
  }
  if (slug === 'fema-disaster-declarations') {
    return {
      jobless: null,
      hawaii: null,
      obesity: null,
      temperature: null,
      seaLevel: null,
      treasuryRate: null,
      fema: await fetchFemaDeclarationStory(),
      foodRecalls: null,
      peakStreamflow: null,
      cpsc: null,
      cfpb: null,
    };
  }
  if (slug === 'fda-food-recalls') {
    return {
      jobless: null,
      hawaii: null,
      obesity: null,
      temperature: null,
      seaLevel: null,
      treasuryRate: null,
      fema: null,
      foodRecalls: await fetchFoodRecallStory(),
      peakStreamflow: null,
      cpsc: null,
      cfpb: null,
    };
  }
  if (slug === 'mississippi-peak-flow') {
    return {
      jobless: null,
      hawaii: null,
      obesity: null,
      temperature: null,
      seaLevel: null,
      treasuryRate: null,
      fema: null,
      foodRecalls: null,
      peakStreamflow: await fetchPeakStreamflowStory(),
      cpsc: null,
      cfpb: null,
    };
  }
  if (slug === 'cpsc-product-recalls') {
    return {
      jobless: null,
      hawaii: null,
      obesity: null,
      temperature: null,
      seaLevel: null,
      treasuryRate: null,
      fema: null,
      foodRecalls: null,
      peakStreamflow: null,
      cpsc: await fetchCpscProductRecallStory(),
      cfpb: null,
    };
  }
  if (slug === 'cfpb-consumer-complaints') {
    return {
      jobless: null,
      hawaii: null,
      obesity: null,
      temperature: null,
      seaLevel: null,
      treasuryRate: null,
      fema: null,
      foodRecalls: null,
      peakStreamflow: null,
      cpsc: null,
      cfpb: await fetchCfpConsumerComplaintStory(),
    };
  }
  return {
    jobless: await fetchJoblessSeries(),
    hawaii: null,
    obesity: null,
    temperature: null,
    seaLevel: null,
    treasuryRate: null,
    fema: null,
    foodRecalls: null,
    peakStreamflow: null,
    cpsc: null,
    cfpb: null,
  };
}

const NO_STORY_CONTENT: { chart: React.ReactNode; stats: React.ReactNode } = {
  chart: null,
  stats: null,
};

function renderStoryContent(
  slug: string,
  data: StoryData,
): { chart: React.ReactNode; stats: React.ReactNode } {
  switch (slug) {
    case 'jobless-rate': {
      const { jobless } = data;
      if (jobless === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: <JoblessChart points={jobless.points} />,
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label={`Rate in ${jobless.latestLabel}`}
              value={formatPercent(jobless.latest.value)}
              accent="teal"
              testId="jobless-latest"
              dataValue={jobless.latest.value}
            />
            <StatCard
              label={`Peak, ${jobless.peakLabel}`}
              value={formatPercent(jobless.peak.value)}
              accent="teal"
              testId="jobless-peak"
              dataValue={jobless.peak.value}
            />
            <StatCard
              label="Change since the peak"
              value={formatPointChange(jobless.changeFromPeak)}
              accent="teal"
              testId="jobless-change"
              dataValue={jobless.changeFromPeak}
            />
          </dl>
        ),
      };
    }
    case 'hawaii-quakes': {
      const { hawaii } = data;
      if (hawaii === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: <HawaiiQuakesChart bands={hawaii.bands} count={hawaii.count} />,
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label="Earthquakes in 2025"
              value={formatCount(hawaii.count)}
              accent="cyan"
              testId="quakes-count"
              dataValue={hawaii.count}
            />
            <StatCard
              label={`Strongest, ${hawaii.strongestLabel}`}
              value={formatMagnitude(hawaii.strongest.magnitude)}
              accent="cyan"
              testId="quakes-strongest"
              dataValue={hawaii.strongest.magnitude}
            />
            <StatCard
              label="Below magnitude 3"
              value={formatCount(hawaii.belowMagnitude3)}
              accent="cyan"
              testId="quakes-below-3"
              dataValue={hawaii.belowMagnitude3}
            />
          </dl>
        ),
      };
    }
    case 'cdc-county-obesity': {
      const { obesity } = data;
      if (obesity === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: (
          <CdcObesityChart
            bands={obesity.bands}
            countyCount={obesity.countyCount}
            medianPercent={obesity.medianPercent}
            nationalPercent={obesity.nationalPercent}
            nationalBandLabel={bandLabelForPercent(obesity.bands, obesity.nationalPercent)}
            medianBandLabel={bandLabelForPercent(obesity.bands, obesity.medianPercent)}
          />
        ),
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label="Counties with an estimate"
              value={formatCount(obesity.countyCount)}
              accent="rose"
              testId="obesity-counties"
              dataValue={obesity.countyCount}
            />
            <StatCard
              label="Median county"
              value={formatPercent(obesity.medianPercent)}
              accent="rose"
              testId="obesity-median"
              dataValue={obesity.medianPercent}
            />
            <StatCard
              label={`Counties above ${formatPercent(obesity.nationalPercent)}`}
              value={formatCount(obesity.aboveNationalCount)}
              accent="rose"
              testId="obesity-above-national"
              dataValue={obesity.aboveNationalCount}
            />
          </dl>
        ),
      };
    }
    case 'us-temperature-record': {
      const { temperature } = data;
      if (temperature === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: (
          <UsTemperatureStripChart
            points={temperature.points}
            decadeLabels={temperature.decadeLabels}
            twentiethCenturyMean={temperature.twentiethCenturyMean}
            yearCount={temperature.yearCount}
            warmest={temperature.warmest}
            coldest={temperature.coldest}
          />
        ),
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label={`Warmest year, ${temperature.warmest.year}`}
              value={formatFahrenheit(temperature.warmest.valueFahrenheit)}
              accent="amber"
              testId="temperature-warmest"
              dataValue={temperature.warmest.valueFahrenheit}
            />
            <StatCard
              label={`${temperature.latest.year} against the 20th century`}
              value={formatFahrenheitChange(temperature.latestChange)}
              accent="amber"
              testId="temperature-latest-change"
              dataValue={temperature.latestChange}
            />
            <StatCard
              label="Years above the average since 2000"
              value={`${formatCount(temperature.recentAboveCount)} of ${formatCount(temperature.recentYearCount)}`}
              accent="amber"
              testId="temperature-recent-above"
              dataValue={temperature.recentAboveCount}
            />
          </dl>
        ),
      };
    }
    case 'battery-sea-level': {
      const { seaLevel } = data;
      if (seaLevel === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: (
          <SeaLevelDotPlot
            points={seaLevel.points}
            stationName={seaLevel.stationName}
            yearCount={seaLevel.yearCount}
            riseMeters={seaLevel.riseMeters}
            trendMillimetresPerYear={seaLevel.trendMillimetresPerYear}
            trendStartMeters={seaLevel.trendStartMeters}
            trendEndMeters={seaLevel.trendEndMeters}
          />
        ),
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label={`Rise since ${String(seaLevel.firstYear.year)}`}
              value={formatMetresChange(seaLevel.riseMeters)}
              accent="sky"
              testId="sea-level-rise"
              dataValue={seaLevel.riseMeters}
            />
            <StatCard
              label={`${String(seaLevel.lastYear.year)} against the datum`}
              value={formatMetresChange(seaLevel.lastYear.meanSeaLevelMeters)}
              accent="sky"
              testId="sea-level-latest"
              dataValue={seaLevel.lastYear.meanSeaLevelMeters}
            />
            <StatCard
              label="Trend across the record"
              value={formatMillimetresPerYear(seaLevel.trendMillimetresPerYear)}
              accent="sky"
              testId="sea-level-trend"
              dataValue={seaLevel.trendMillimetresPerYear}
            />
          </dl>
        ),
      };
    }
    case 'treasury-interest-rate': {
      const { treasuryRate } = data;
      if (treasuryRate === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: <TreasuryRateChart points={treasuryRate.points} />,
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label={`Rate in ${treasuryRate.latest.label}`}
              value={formatPercentTwoDecimals(treasuryRate.latest.ratePercent)}
              accent="emerald"
              testId="treasury-latest"
              dataValue={treasuryRate.latest.ratePercent}
            />
            <StatCard
              label={`Lowest, ${treasuryRate.lowest.label}`}
              value={formatPercentTwoDecimals(treasuryRate.lowest.ratePercent)}
              accent="emerald"
              testId="treasury-lowest"
              dataValue={treasuryRate.lowest.ratePercent}
            />
            <StatCard
              label="Change since the low"
              value={formatPointChange(treasuryRate.changeSinceLow)}
              accent="emerald"
              testId="treasury-change"
              dataValue={treasuryRate.changeSinceLow}
            />
          </dl>
        ),
      };
    }
    case 'fema-disaster-declarations': {
      const { fema } = data;
      if (fema === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: (
          <FemaDeclarationsChart
            bars={fema.bars}
            declarationCount={fema.declarationCount}
            fireCount={fema.fireCount}
            newestYear={fema.newestYear}
            newestYearCount={fema.newestYearCount}
          />
        ),
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label="Declarations in the file"
              value={formatCount(fema.declarationCount)}
              accent="indigo"
              testId="fema-count"
              dataValue={fema.declarationCount}
            />
            <StatCard
              label={`Busiest year, ${String(fema.busiestYear.year)}`}
              value={formatCount(fema.busiestYear.total)}
              accent="indigo"
              testId="fema-busiest-year"
              dataValue={fema.busiestYear.total}
            />
            <StatCard
              label="Declarations for fire"
              value={formatCount(fema.fireCount)}
              accent="indigo"
              testId="fema-fire"
              dataValue={fema.fireCount}
            />
          </dl>
        ),
      };
    }
    case 'fda-food-recalls': {
      const { foodRecalls } = data;
      if (foodRecalls === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: (
          <FoodRecallsChart
            bars={foodRecalls.bars}
            recallCount={foodRecalls.recallCount}
            classOneCount={foodRecalls.classOneCount}
            newestYear={foodRecalls.newestYear}
            newestYearCount={foodRecalls.newestYearCount}
          />
        ),
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label="Recalls in the file"
              value={formatCount(foodRecalls.recallCount)}
              accent="lime"
              testId="food-recalls-count"
              dataValue={foodRecalls.recallCount}
            />
            <StatCard
              label={`Class I, ${formatPercent(foodRecalls.classOneSharePercent)} of the file`}
              value={formatCount(foodRecalls.classOneCount)}
              accent="lime"
              testId="food-recalls-class-one"
              dataValue={foodRecalls.classOneCount}
            />
            <StatCard
              label={`Busiest year, ${String(foodRecalls.busiestYear.year)}`}
              value={formatCount(foodRecalls.busiestYear.total)}
              accent="lime"
              testId="food-recalls-busiest"
              dataValue={foodRecalls.busiestYear.total}
            />
          </dl>
        ),
      };
    }
    case 'mississippi-peak-flow': {
      const { peakStreamflow } = data;
      if (peakStreamflow === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: (
          <PeakStreamflowChart
            bars={peakStreamflow.bars}
            medianDischargeCubicFeetPerSecond={peakStreamflow.medianDischargeCubicFeetPerSecond}
            bigPeakThresholdCubicFeetPerSecond={BIG_PEAK_CUBIC_FEET_PER_SECOND}
            bigPeakYears={peakStreamflow.bigPeakYears}
          />
        ),
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label={`Record peak, ${peakStreamflow.record.peakDateLabel}`}
              value={formatDischargeCubicFeetPerSecond(
                peakStreamflow.record.dischargeCubicFeetPerSecond,
              )}
              accent="violet"
              testId="peak-streamflow-record"
              dataValue={peakStreamflow.record.dischargeCubicFeetPerSecond}
            />
            <StatCard
              label="Middle water year"
              value={formatDischargeCubicFeetPerSecond(
                peakStreamflow.medianDischargeCubicFeetPerSecond,
              )}
              accent="violet"
              testId="peak-streamflow-median"
              dataValue={peakStreamflow.medianDischargeCubicFeetPerSecond}
            />
            <StatCard
              label="Years above 900,000 cfs"
              value={`${formatCount(peakStreamflow.bigPeakYears.length)} of ${formatCount(peakStreamflow.yearCount)}`}
              accent="violet"
              testId="peak-streamflow-big-years"
              dataValue={peakStreamflow.bigPeakYears.length}
            />
          </dl>
        ),
      };
    }
    case 'cpsc-product-recalls': {
      const { cpsc } = data;
      if (cpsc === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: (
          <CpscRecallsChart
            bars={cpsc.bars}
            totalRecalls={cpsc.totalRecalls}
            newestYear={cpsc.newestYear}
            newestYearCount={cpsc.newestYearCount}
            newestRecallDateLabel={cpsc.newestRecallDateLabel}
            remedies={cpsc.remedies}
          />
        ),
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label={`Recalls since ${String(cpsc.firstYear)}`}
              value={formatCount(cpsc.totalRecalls)}
              accent="fuchsia"
              testId="cpsc-recalls-total"
              dataValue={cpsc.totalRecalls}
            />
            <StatCard
              label={`${String(cpsc.newestYear)} so far`}
              value={formatCount(cpsc.newestYearCount)}
              accent="fuchsia"
              testId="cpsc-recalls-newest-year"
              dataValue={cpsc.newestYearCount}
            />
            <StatCard
              label="Recalls naming China"
              value={formatCount(cpsc.topCountryCount)}
              accent="fuchsia"
              testId="cpsc-recalls-top-country"
              dataValue={cpsc.topCountryCount}
            />
          </dl>
        ),
      };
    }
    case 'cfpb-consumer-complaints': {
      const { cfpb } = data;
      if (cfpb === null) {
        return NO_STORY_CONTENT;
      }
      return {
        chart: (
          <CfpbComplaintsChart
            bars={cfpb.bars}
            totalComplaints={cfpb.totalComplaints}
            newestYear={cfpb.newestYear}
            newestYearCount={cfpb.newestYearCount}
            newestReceivedDateLabel={cfpb.newestReceivedDateLabel}
            companies={cfpb.companies}
          />
        ),
        stats: (
          <dl className="grid gap-6 py-[var(--spacing-2xl)] sm:grid-cols-3">
            <StatCard
              label="Complaints in the file"
              value={formatCount(cfpb.totalComplaints)}
              accent="purple"
              testId="cfpb-complaints-total"
              dataValue={cfpb.totalComplaints}
            />
            <StatCard
              label={`${String(cfpb.newestYear)} so far`}
              value={formatCount(cfpb.newestYearCount)}
              accent="purple"
              testId="cfpb-complaints-newest-year"
              dataValue={cfpb.newestYearCount}
            />
            <StatCard
              label="Complaints naming the three bureaus"
              value={formatCount(cfpb.topThreeCount)}
              accent="purple"
              testId="cfpb-complaints-top-three"
              dataValue={cfpb.topThreeCount}
            />
          </dl>
        ),
      };
    }
    default:
      return NO_STORY_CONTENT;
  }
}
