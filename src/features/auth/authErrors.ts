/** The `auth/...` code on a Firebase Auth error, or '' when there isn't one. */
export function authErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  return '';
}

const MISMATCH = "That email and password don't match.";

const MESSAGES: Record<string, string | null> = {
  // Firebase merges these into invalid-credential when email enumeration
  // protection is on; the older codes still appear on projects without it.
  'auth/invalid-credential': MISMATCH,
  'auth/invalid-login-credentials': MISMATCH,
  'auth/wrong-password': MISMATCH,
  'auth/user-not-found': MISMATCH,
  'auth/email-already-in-use': "There's already an account with this email.",
  'auth/weak-password': 'Use at least 6 characters.',
  'auth/invalid-email': "That doesn't look like an email address.",
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': "Can't reach the server. Check your connection and try again.",
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups and try again.',
  'auth/user-disabled': 'This account has been turned off.',
  // The user closed the Google popup themselves; nothing to report.
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
  'auth/user-cancelled': null,
};

/** Plain-English text for an auth error code, or null when it needs no message. */
export function authErrorMessage(code: string): string | null {
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : 'Something went wrong. Try again.';
}
