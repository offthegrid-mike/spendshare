import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopShops from './TopShops';

const shops = [
  { shopName: 'Woolworths', amount: 10000, visits: 2 },
  { shopName: 'Cafe Nero', amount: 2000, visits: 1 },
];

describe('TopShops', () => {
  it('lists each shop with its spend and number of visits', () => {
    render(<TopShops shops={shops} currency="AUD" />);
    expect(screen.getByRole('heading', { name: 'Top shops' })).toBeInTheDocument();
    const rows = screen.getAllByTestId('shop-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Woolworths');
    expect(rows[0]).toHaveTextContent('2 visits');
    expect(rows[0]).toHaveTextContent('A$100.00');
    expect(rows[1]).toHaveTextContent('1 visit');
    expect(rows[1]).not.toHaveTextContent('1 visits');
  });

  it('renders nothing without shops', () => {
    const { container } = render(<TopShops shops={[]} currency="AUD" />);
    expect(container).toBeEmptyDOMElement();
  });
});
