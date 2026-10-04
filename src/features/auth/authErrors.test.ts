import { describe, it, expect } from 'vitest';
import { authErrorCode, authErrorMessage } from './authErrors';

describe('authErrorCode', () => {
  it('reads the code from a Firebase-style error', () => {
    const err = Object.assign(new Error('Firebase: Error (auth/invalid-credential).'), {
      code: 'auth/invalid-credential',
    });
    expect(authErrorCode(err)).toBe('auth/invalid-credential');
  });

  it('returns an empty string when there is no code', () => {
    expect(authErrorCode(new Error('boom'))).toBe('');
    expect(authErrorCode('boom')).toBe('');
    expect(authErrorCode(null)).toBe('');
  });
});

describe('authErrorMessage', () => {
  it.each([
    'auth/invalid-credential',
    'auth/invalid-login-credentials',
    'auth/wrong-password',
    'auth/user-not-found',
  ])('treats %s as a mismatched email and password', (code) => {
    expect(authErrorMessage(code)).toBe("That email and password don't match.");
  });

  it.each([
    ['auth/email-already-in-use', "There's already an account with this email."],
    ['auth/weak-password', 'Use at least 6 characters.'],
    ['auth/invalid-email', "That doesn't look like an email address."],
    ['auth/too-many-requests', 'Too many attempts. Wait a minute and try again.'],
    ['auth/network-request-failed', "Can't reach the server. Check your connection and try again."],
    ['auth/popup-blocked', 'Your browser blocked the Google window. Allow pop-ups and try again.'],
    ['auth/user-disabled', 'This account has been turned off.'],
  ])('maps %s to plain English', (code, message) => {
    expect(authErrorMessage(code)).toBe(message);
  });

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'])(
    'stays silent for %s because the user closed the popup themselves',
    (code) => {
      expect(authErrorMessage(code)).toBeNull();
    },
  );

  it('falls back to a generic message for unknown codes', () => {
    expect(authErrorMessage('auth/something-new')).toBe('Something went wrong. Try again.');
    expect(authErrorMessage('')).toBe('Something went wrong. Try again.');
  });

  it('never leaks the raw Firebase text', () => {
    for (const code of ['auth/invalid-credential', 'auth/something-new']) {
      expect(authErrorMessage(code)).not.toMatch(/firebase|auth\//i);
    }
  });
});
