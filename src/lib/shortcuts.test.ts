import { describe, it, expect, afterEach } from 'vitest';
import { ignoreShortcut, SHORTCUTS } from './shortcuts';

function keydown(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

function element(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ignoreShortcut', () => {
  it('lets a plain key on the page through', () => {
    expect(ignoreShortcut(keydown('n'))).toBe(false);
  });

  it.each(['input', 'textarea', 'select'])('ignores keys typed in a %s', (tag) => {
    expect(ignoreShortcut(keydown('n', {}, element(tag)))).toBe(true);
  });

  it('ignores keys typed in an editable element', () => {
    const editable = element('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(ignoreShortcut(keydown('n', {}, editable))).toBe(true);
  });

  it('allows typing targets when asked, for shortcuts like ⌘K', () => {
    expect(ignoreShortcut(keydown('k', { metaKey: true }, element('input')), { whileTyping: true, mod: true })).toBe(false);
  });

  it.each([{ metaKey: true }, { ctrlKey: true }, { altKey: true }])('ignores a key pressed with %o', (mods) => {
    expect(ignoreShortcut(keydown('n', mods))).toBe(true);
  });

  it('allows Shift, which ? needs', () => {
    expect(ignoreShortcut(keydown('?', { shiftKey: true }))).toBe(false);
  });

  it('needs ⌘ or Ctrl for a mod shortcut, and ignores Alt with it', () => {
    expect(ignoreShortcut(keydown('k'), { mod: true })).toBe(true);
    expect(ignoreShortcut(keydown('k', { ctrlKey: true }), { mod: true })).toBe(false);
    expect(ignoreShortcut(keydown('k', { metaKey: true, altKey: true }), { mod: true })).toBe(true);
  });

  it('ignores a key another control already handled', () => {
    const event = keydown('n');
    event.preventDefault();
    expect(ignoreShortcut(event)).toBe(true);
  });

  it('ignores keys while a popover is open', () => {
    element('button', { 'aria-haspopup': 'menu', 'aria-expanded': 'true' });
    expect(ignoreShortcut(keydown('n'))).toBe(true);
  });

  it('lets keys through when a popover trigger is closed', () => {
    element('button', { 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
    expect(ignoreShortcut(keydown('n'))).toBe(false);
  });

  it('ignores keys while a dialog is open', () => {
    element('div', { 'aria-modal': 'true' });
    expect(ignoreShortcut(keydown('n'))).toBe(true);
  });
});

describe('SHORTCUTS', () => {
  it('lists every shortcut once, with a description', () => {
    const keys = SHORTCUTS.flatMap((group) => group.shortcuts.map((s) => s.keys.join('+')));
    expect(new Set(keys).size).toBe(keys.length);
    for (const group of SHORTCUTS) {
      for (const s of group.shortcuts) expect(s.description.length).toBeGreaterThan(0);
    }
  });
});
