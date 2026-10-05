import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it } from 'vitest';

import AboutPage from './page';

expect.extend(toHaveNoViolations);

describe('AboutPage', () => {
  it('explains what the site is and where the data comes from', () => {
    render(<AboutPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'About usa-open-data-lab' }),
    ).toBeVisible();
    expect(screen.getByText(/peaked at 14.8 percent in April 2020/)).toBeVisible();
    expect(screen.getByText(/Bureau of Labor Statistics public data API/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'usa-open-data-connectors' })).toHaveAttribute(
      'href',
      'https://github.com/olitreadwell/usa-open-data-connectors',
    );
    expect(screen.getByRole('link', { name: 'awesome-usa-open-data' })).toHaveAttribute(
      'href',
      'https://github.com/olitreadwell/awesome-usa-open-data',
    );
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/olitreadwell/usa-open-data-lab',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AboutPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
