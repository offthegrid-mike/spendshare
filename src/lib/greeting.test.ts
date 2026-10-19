import { describe, it, expect } from 'vitest';
import { firstNameOf, greeting, longDate } from './greeting';

describe('greeting', () => {
  it('says good morning before noon', () => {
    expect(greeting(9, 'Mike')).toBe('Good morning, Mike');
    expect(greeting(0, 'Mike')).toBe('Good morning, Mike');
  });

  it('says good afternoon from noon until 18:00', () => {
    expect(greeting(12, 'Mike')).toBe('Good afternoon, Mike');
    expect(greeting(17, 'Mike')).toBe('Good afternoon, Mike');
  });

  it('says good evening from 18:00', () => {
    expect(greeting(18, 'Mike')).toBe('Good evening, Mike');
  });
});

describe('firstNameOf', () => {
  it('takes the first word of the display name', () => {
    expect(firstNameOf('Mike Smith', null)).toBe('Mike');
  });

  it('falls back to the part of the email before the @', () => {
    expect(firstNameOf(null, 'priya@example.com')).toBe('priya');
  });

  it('falls back to "there" with neither', () => {
    expect(firstNameOf(null, null)).toBe('there');
  });

  it('treats a whitespace-only display name as missing', () => {
    expect(firstNameOf('  ', null)).toBe('there');
    expect(firstNameOf('  ', 'priya@example.com')).toBe('priya');
  });
});

describe('longDate', () => {
  it('writes a local date as the weekday, day and month with single spaces', () => {
    expect(longDate('2026-10-19')).toBe('Monday 19 October');
    expect(longDate('2026-10-18')).toBe('Sunday 18 October');
    expect(longDate('2027-01-01')).toBe('Friday 1 January');
  });
});
