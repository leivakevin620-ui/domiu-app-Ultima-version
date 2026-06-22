import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getTestingFoundationStatus } from './smoke';

function SmokeComponent() {
  return <h1>DomiU testing foundation</h1>;
}

describe('testing foundation', () => {
  it('renders React components with Testing Library', () => {
    render(<SmokeComponent />);

    expect(screen.getByRole('heading', { name: 'DomiU testing foundation' })).toBeInTheDocument();
  });

  it('collects coverage for source modules', () => {
    expect(getTestingFoundationStatus()).toBe('ready');
  });
});
