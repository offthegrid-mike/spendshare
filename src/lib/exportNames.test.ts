import { describe, it, expect } from 'vitest';
import { backupFileName, csvFileName, exportName, periodLabel, periodMonths } from './exportNames';
import { makeGroup } from '../test/fixtures';

const group = makeGroup('g1', 'Hartley House');

describe('periodMonths', () => {
  it('is one month for a month, and January to December for a year', () => {
    expect(periodMonths({ kind: 'month', month: '2026-10' })).toEqual({ from: '2026-10', to: '2026-10' });
    expect(periodMonths({ kind: 'year', year: '2026' })).toEqual({ from: '2026-01', to: '2026-12' });
  });
});

describe('periodLabel', () => {
  it('names the month or the year', () => {
    expect(periodLabel({ kind: 'month', month: '2026-10' })).toBe('October 2026');
    expect(periodLabel({ kind: 'year', year: '2026' })).toBe('2026');
  });
});

describe('csvFileName', () => {
  it('names the group and the period', () => {
    expect(csvFileName(group, { kind: 'month', month: '2026-10' })).toBe('spendshare-hartley-house-2026-10.csv');
    expect(csvFileName(group, { kind: 'year', year: '2026' })).toBe('spendshare-hartley-house-2026.csv');
  });

  it('keeps a file name safe, whatever the group is called', () => {
    expect(csvFileName({ ...group, name: "Mike & Priya's / flat #2" }, { kind: 'year', year: '2026' })).toBe('spendshare-mike-priya-s-flat-2-2026.csv');
    expect(csvFileName({ ...group, name: '我的家' }, { kind: 'year', year: '2026' })).toBe('spendshare-group-2026.csv');
  });
});

describe('backupFileName', () => {
  it('names the group and the day', () => {
    expect(backupFileName(group, new Date(2026, 9, 26, 12))).toBe('spendshare-hartley-house-backup-2026-10-26.json');
  });
});

describe('exportName', () => {
  it('leaves a name as it is', () => {
    expect(exportName('Priya')).toBe('Priya');
    expect(exportName('Mike @ Home')).toBe('Mike @ Home');
    expect(exportName('冷奴')).toBe('冷奴');
  });

  it('keeps only what is before the @ of an email address, since a name that is one gives the address away', () => {
    expect(exportName('priya.s@example.com')).toBe('priya.s');
    expect(exportName('Priya (priya@example.com)')).toBe('Priya (priya)');
    expect(exportName('priya@example.com')).not.toContain('@');
  });

  it('is empty for nothing', () => {
    expect(exportName('')).toBe('');
  });
});
