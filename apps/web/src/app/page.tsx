import { Container, Stack } from '@usa-open-data-lab/ui';

import { MicrositeGallery } from '@/components/MicrositeGallery';
import type { MicrositeGalleryCard } from '@/components/MicrositeGallery';
import { ReportIssueButton } from '@/components/ReportIssueButton';
import { fetchJoblessSeries } from '@/lib/jobless-data';
import { categorySlugFor, MICROSITES } from '@/lib/microsites';
import type { MicrositeConfig } from '@/lib/microsites';
import { formatPercent } from '@/lib/us-format';

function getMicrosite(slug: string): MicrositeConfig | undefined {
  return MICROSITES.find((candidate) => candidate.slug === slug);
}

export default async function HomePage(): Promise<React.ReactElement> {
  const jobless = await fetchJoblessSeries();

  const cards = [
    {
      config: getMicrosite('jobless-rate'),
      statLabel: `Unemployment, ${jobless.latestLabel}`,
      statValue: formatPercent(jobless.latest.value),
    },
  ].filter(
    (card): card is { config: MicrositeConfig; statLabel: string; statValue: string } =>
      card.config !== undefined,
  );
  // The home page shows every published microsite; only the curated ones carry
  // a headline stat fetched at deploy time.
  const statBySlug = new Map(
    cards.map((card) => [
      card.config.slug,
      { statLabel: card.statLabel, statValue: card.statValue },
    ]),
  );
  // The full microsite list is in ship order (oldest first); show the newest first.
  const galleryCards: MicrositeGalleryCard[] = [...MICROSITES].reverse().map((config) => {
    const stat = statBySlug.get(config.slug);
    return {
      slug: config.slug,
      categorySlug: categorySlugFor(config),
      eyebrow: config.eyebrow,
      title: config.title,
      description: config.description,
      accent: config.accent,
      dataSource: config.dataSource,
      chartType: config.chartType,
      category: config.category,
      ...(stat !== undefined ? { statLabel: stat.statLabel, statValue: stat.statValue } : {}),
    };
  });

  return (
    <>
      <Container size="wide">
        <Stack className="max-w-3xl gap-4 py-[var(--spacing-2xl)]">
          <h1 className="numeral-heading-3xl">
            Small experiments digging through US public data for the funny and the surprising.
          </h1>
          <p className="numeral-paragraph-lg text-[var(--color-muted)]">
            {galleryCards.length} live microsite{galleryCards.length === 1 ? '' : 's'}. A Bureau of
            Labor Statistics series and a USGS earthquake catalogue, read at deploy time from
            keyless APIs.
          </p>
        </Stack>
        <div className="pb-[var(--spacing-3xl)]">
          <MicrositeGallery cards={galleryCards} />
        </div>
      </Container>
      <ReportIssueButton />
    </>
  );
}
