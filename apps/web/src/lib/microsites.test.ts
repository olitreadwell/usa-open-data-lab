import { describe, expect, it } from 'vitest';

import {
  CATEGORY_DETAILS,
  freshnessLabelFor,
  micrositePathFor,
  MICROSITES,
  relatedMicrositesFor,
} from './microsites';

describe('MICROSITES taxonomy', () => {
  it('gives every microsite a data source, chart type, and category', () => {
    for (const microsite of MICROSITES) {
      expect(microsite.dataSource.length, microsite.slug).toBeGreaterThan(0);
      expect(microsite.chartType.length, microsite.slug).toBeGreaterThan(0);
      expect(microsite.category.length, microsite.slug).toBeGreaterThan(0);
    }
  });

  it('has unique slugs', () => {
    const slugs = MICROSITES.map((microsite) => microsite.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('keeps every filter dimension selectable', () => {
    const sources = new Set(MICROSITES.map((microsite) => microsite.dataSource));
    const chartTypes = new Set(MICROSITES.map((microsite) => microsite.chartType));
    const categories = new Set(MICROSITES.map((microsite) => microsite.category));
    expect(sources.size).toBeGreaterThanOrEqual(1);
    expect(chartTypes.size).toBeGreaterThanOrEqual(1);
    expect(categories.size).toBeGreaterThanOrEqual(1);
  });

  it('gives every microsite key facts, a reading guide, and a source URL', () => {
    for (const microsite of MICROSITES) {
      expect(microsite.keyFacts.length, microsite.slug).toBeGreaterThanOrEqual(3);
      expect(microsite.howToRead.length, microsite.slug).toBeGreaterThan(0);
      expect(microsite.sourceUrl.startsWith('https://'), microsite.slug).toBe(true);
    }
  });

  it('describes every category', () => {
    const categories = new Set(MICROSITES.map((microsite) => microsite.category));
    for (const category of categories) {
      expect(CATEGORY_DETAILS[category].length, category).toBeGreaterThan(0);
    }
  });
});

describe('relatedMicrositesFor', () => {
  it('points every related link at an existing page', () => {
    const knownPaths = new Set(MICROSITES.map((microsite) => micrositePathFor(microsite)));
    for (const microsite of MICROSITES) {
      for (const related of relatedMicrositesFor(microsite)) {
        expect(knownPaths.has(micrositePathFor(related)), related.slug).toBe(true);
      }
    }
  });

  it('returns no related stories while only one microsite is published', () => {
    const jobless = MICROSITES.find((microsite) => microsite.slug === 'jobless-rate');
    if (jobless === undefined) {
      throw new Error('jobless-rate missing');
    }
    expect(relatedMicrositesFor(jobless)).toHaveLength(0);
  });
});

describe('freshnessLabelFor', () => {
  it('labels deploy-time fetches', () => {
    const fetched = MICROSITES.find((microsite) => microsite.slug === 'jobless-rate');
    if (fetched === undefined) {
      throw new Error('jobless-rate missing');
    }
    expect(freshnessLabelFor(fetched)).toContain('deploy time');
  });
});
