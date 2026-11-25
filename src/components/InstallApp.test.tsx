import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallApp from './InstallApp';
import { usePwaStore, type BeforeInstallPromptEvent } from '../lib/pwa';

const { ios } = vi.hoisted(() => ({ ios: { value: false } }));
vi.mock('../lib/pwa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/pwa')>()),
  isIos: () => ios.value,
}));

function prompt() {
  return Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
  }) as unknown as BeforeInstallPromptEvent;
}

describe('InstallApp', () => {
  beforeEach(() => {
    ios.value = false;
    usePwaStore.setState({ installPrompt: null, installed: false, needRefresh: false, updateSW: null });
  });

  it('offers an Install button when the browser can install, and shows its prompt', async () => {
    const event = prompt();
    usePwaStore.setState({ installPrompt: event });
    render(<InstallApp />);
    await userEvent.click(screen.getByRole('button', { name: /install homebase/i }));
    expect(event.prompt).toHaveBeenCalled();
  });

  it('explains Add to Home Screen on an iPhone or iPad', () => {
    ios.value = true;
    render(<InstallApp />);
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument();
  });

  it('shows nothing once installed', () => {
    ios.value = true;
    usePwaStore.setState({ installPrompt: prompt(), installed: true });
    const { container } = render(<InstallApp />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing where the browser cannot install', () => {
    const { container } = render(<InstallApp />);
    expect(container).toBeEmptyDOMElement();
  });
});
