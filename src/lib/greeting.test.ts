import { describe, it, expect } from 'vitest';
import { firstNameOf, greeting, hourOf, longDate } from './greeting';

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

describe('longDate and hourOf', () => {
  const monday9am = new Date(2026, 9, 19, 9, 0).getTime();

  it('formats the weekday, day and month with single spaces', () => {
    expect(longDate(monday9am)).toBe('Monday 19 October');
  });

  it('reads the local hour, 0 to 23', () => {
    expect(hourOf(monday9am)).toBe(9);
    expect(hourOf(new Date(2026, 9, 19, 0, 30).getTime())).toBe(0);
    expect(hourOf(new Date(2026, 9, 19, 23, 59).getTime())).toBe(23);
  });
});
