import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  useOutgoingInvites,
  sendInvite,
  revokeInvite,
} from '../../hooks/useInvites';

interface Props {
  user: User;
  group: { id: string; name: string };
}

export default function SendInvite({ user, group }: Props) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const { invites } = useOutgoingInvites(group.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    if (!trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await sendInvite({
        gid: group.id,
        email: trimmed.toLowerCase(),
        invitedByUid: user.uid,
        invitedByName: user.displayName ?? user.email ?? '',
        groupName: group.name,
      });
      setEmail('');
    } catch {
      setError('Failed to send invite. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-xl font-semibold text-gray-800">
          Invite to {group.name}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="invite-email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="mt-1 text-xs text-gray-500">
              Invite the exact email they&apos;ll sign in with.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      </div>

      {invites.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Invites</h2>
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <ul className="divide-y divide-gray-100">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <p className="text-sm text-gray-800">{invite.email}</p>
                  <p className="text-xs capitalize text-gray-500">
                    {invite.status}
                  </p>
                </div>
                {invite.status === 'pending' && (
                  <button
                    type="button"
                    disabled={revoking === invite.email}
                    onClick={() => {
                      setRevoking(invite.email);
                      setError('');
                      revokeInvite(group.id, invite.email)
                        .catch(() => {
                          setError('Failed to revoke invite. Please try again.');
                        })
                        .finally(() => setRevoking(null));
                    }}
                    className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
