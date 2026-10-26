import { describe, it, expect } from 'vitest';
import { csvEscape, csvLine, csvMoney } from './csv';

describe('csvEscape', () => {
  it('leaves plain text and numbers as they are', () => {
    expect(csvEscape('Coles')).toBe('Coles');
    expect(csvEscape(12.5)).toBe('12.5');
    expect(csvEscape(0)).toBe('0');
  });

  it('is empty for null and undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('quotes a cell holding a comma, a quote or a line break, doubling the quotes', () => {
    expect(csvEscape('Bread, rolls')).toBe('"Bread, rolls"');
    expect(csvEscape('the "good" one')).toBe('"the ""good"" one"');
    expect(csvEscape('two\nlines')).toBe('"two\nlines"');
    expect(csvEscape('two\r\nlines')).toBe('"two\r\nlines"');
  });

  it('keeps non-Latin text as it is', () => {
    expect(csvEscape('冷奴豆腐')).toBe('冷奴豆腐');
    expect(csvEscape('خبز')).toBe('خبز');
  });
});

describe('csvLine', () => {
  it('joins escaped cells with commas and ends the line', () => {
    expect(csvLine(['a', 'b,c', 3, null])).toBe('a,"b,c",3,\n');
  });
});

describe('csvMoney', () => {
  it('writes cents as a plain two-place decimal', () => {
    expect(csvMoney(0)).toBe('0.00');
    expect(csvMoney(5)).toBe('0.05');
    expect(csvMoney(1599)).toBe('15.99');
    expect(csvMoney(1234567)).toBe('12345.67');
  });

  it('puts an ASCII minus on a negative amount', () => {
    expect(csvMoney(-700)).toBe('-7.00');
    expect(csvMoney(-1)).toBe('-0.01');
    expect(csvMoney(-700)).not.toContain('−');
  });
});
