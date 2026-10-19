import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import type { Clock } from '../../lib/work/workDates';
import { DEFAULT_WORK_SETTINGS } from '../../lib/work/workSettings';
import TodayCard from './TodayCard';

const { mounts } = vi.hoisted(() => ({ mounts: { count: 0 } }));
vi.mock('./DayEditor', async () => {
  const { useState } = await import('react');
  function DayEditorStub({
    uid,
    date,
    existing,
    settings,
    settingsLoaded,
    daysLoaded,
    clock,
    onSaved,
  }: {
    uid: string;
    date: string;
    existing: { type: string | null } | null;
    settings: { defaultMinutes: number };
    settingsLoaded: boolean;
    daysLoaded: boolean;
    clock: { today: string };
    onSaved: () => void;
  }) {
    const [mount] = useState(() => ++mounts.count);
    return (
      <div
        data-testid="day-editor"
        data-uid={uid}
        data-date={date}
        data-existing={existing === null ? 'none' : String(existing.type)}
        data-default-minutes={settings.defaultMinutes}
        data-settings-loaded={String(settingsLoaded)}
        data-days-loaded={String(daysLoaded)}
        data-clock-today={clock.today}
        data-mount={mount}
      >
        <button type="button" onClick={onSaved}>
          Saved
        </button>
      </div>
    );
  }
  return { default: DayEditorStub };
});

const TODAY = '2026-10-19';
const CLOCK: Clock = { today: TODAY, nowMinutes: 540 };
const SETTINGS: WorkSettingsDoc = { ...DEFAULT_WORK_SETTINGS, defaultMinutes: 456 };

function day(overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  return {
    date: TODAY,
    incomeYear: '2026-27',
    type: 'home',
    startTime: '08:30',
    finishTime: '16:06',
    minutes: 456,
    addedLater: false,
    countedInClaim: true,
    finishConfirmed: false,
    firstRecordedAt: {} as Timestamp,
    recordedAt: {} as Timestamp,
    syncedAt: {} as Timestamp,
    revisions: [],
    ...overrides,
  };
}

function renderCard(props: Partial<ComponentProps<typeof TodayCard>> = {}) {
  const onSaved = vi.fn();
  const view = render(
    <TodayCard
      uid="u1"
      existing={null}
      settings={SETTINGS}
      settingsLoaded
      daysLoaded
      clock={CLOCK}
      onSaved={onSaved}
      {...props}
    />,
  );
  return { onSaved, ...view };
}

describe('TodayCard', () => {
  it('is headed with today', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Today · Mon 19 Oct' })).toBeInTheDocument();
  });

  it('says not saved yet when today has no record', () => {
    renderCard({ existing: null });
    expect(screen.getByText('not saved yet')).toBeInTheDocument();
  });

  it('says not saved yet for a cleared record', () => {
    renderCard({ existing: day({ type: null, countedInClaim: false }) });
    expect(screen.getByText('not saved yet')).toBeInTheDocument();
    expect(screen.queryByText('saved')).toBeNull();
  });

  it('says saved for a record with a type', () => {
    renderCard({ existing: day() });
    expect(screen.getByText('saved')).toBeInTheDocument();
    expect(screen.queryByText('not saved yet')).toBeNull();
  });

  it('says saved for an Office record', () => {
    renderCard({ existing: day({ type: 'office', countedInClaim: false }) });
    expect(screen.getByText('saved')).toBeInTheDocument();
  });

  it('says finish confirmed for a Home record with a confirmed finish', () => {
    renderCard({ existing: day({ finishConfirmed: true }) });
    expect(screen.getByText('finish confirmed')).toBeInTheDocument();
    expect(screen.queryByText('saved')).toBeNull();
  });

  it('holds a day editor for today and passes it everything', () => {
    const existing = day();
    const { onSaved } = renderCard({ existing, settingsLoaded: false, daysLoaded: true });
    const editor = screen.getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-uid', 'u1');
    expect(editor).toHaveAttribute('data-date', TODAY);
    expect(editor).toHaveAttribute('data-existing', 'home');
    expect(editor).toHaveAttribute('data-default-minutes', '456');
    expect(editor).toHaveAttribute('data-settings-loaded', 'false');
    expect(editor).toHaveAttribute('data-days-loaded', 'true');
    expect(editor).toHaveAttribute('data-clock-today', TODAY);
    fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('passes a days-not-loaded flag straight through', () => {
    renderCard({ daysLoaded: false });
    expect(screen.getByTestId('day-editor')).toHaveAttribute('data-days-loaded', 'false');
  });

  it('keeps the heading and status but drops the editor while it is hidden', () => {
    renderCard({ existing: day(), editorHidden: true });
    expect(screen.getByRole('heading', { name: 'Today · Mon 19 Oct' })).toBeInTheDocument();
    expect(screen.getByText('saved')).toBeInTheDocument();
    expect(screen.queryByTestId('day-editor')).toBeNull();
  });

  it('shows the editor by default and when not hidden', () => {
    const { rerender, onSaved } = renderCard({ editorHidden: false });
    expect(screen.getByTestId('day-editor')).toBeInTheDocument();
    rerender(
      <TodayCard
        uid="u1"
        existing={null}
        settings={SETTINGS}
        settingsLoaded
        daysLoaded
        clock={CLOCK}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByTestId('day-editor')).toBeInTheDocument();
  });

  it('mounts a fresh editor, seeded from the current record, when it stops being hidden', () => {
    const { rerender, onSaved } = renderCard({ existing: null });
    const mount = screen.getByTestId('day-editor').getAttribute('data-mount');
    const props = { uid: 'u1', settings: SETTINGS, settingsLoaded: true, daysLoaded: true, clock: CLOCK, onSaved };
    rerender(<TodayCard {...props} existing={null} editorHidden />);
    expect(screen.queryByTestId('day-editor')).toBeNull();
    rerender(<TodayCard {...props} existing={day()} />);
    const editor = screen.getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-existing', 'home');
    expect(editor.getAttribute('data-mount')).not.toBe(mount);
  });

  it('keeps its editor while the day stays the same', () => {
    const { rerender, onSaved } = renderCard();
    const mount = screen.getByTestId('day-editor').getAttribute('data-mount');
    rerender(
      <TodayCard
        uid="u1"
        existing={day()}
        settings={SETTINGS}
        settingsLoaded
        daysLoaded
        clock={{ today: TODAY, nowMinutes: 600 }}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByTestId('day-editor')).toHaveAttribute('data-mount', mount);
  });

  it('starts a fresh editor, headed with the new day, when the date rolls over', () => {
    const { rerender, onSaved } = renderCard();
    const mount = screen.getByTestId('day-editor').getAttribute('data-mount');
    rerender(
      <TodayCard
        uid="u1"
        existing={null}
        settings={SETTINGS}
        settingsLoaded
        daysLoaded
        clock={{ today: '2026-10-20', nowMinutes: 0 }}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Today · Tue 20 Oct' })).toBeInTheDocument();
    const editor = screen.getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-date', '2026-10-20');
    expect(editor.getAttribute('data-mount')).not.toBe(mount);
  });
});
