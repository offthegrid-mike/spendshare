import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  useIncomingInvites,
  acceptInvite,
  declineInvite,
} from '../../hooks/useInvites';

interface Props {
  user: User;
}

export default function PendingInvites({ user }: Props) {
  const { invites } = useIncomingInvites(user.email?.toLowerCase() ?? undefined);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(
    null,
  );

  if (invites.length === 0) return null;

  return (
    <div className="space-y-3">
      {invites.map((invite) => {
        const inFlight = pending === invite.ref.path;
        return (
          <div
            key={invite.ref.path}
            className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm"
          >
            <p className="text-sm text-gray-800">
              <span className="font-semibold">{invite.invitedByName}</span>{' '}
              invited you to join{' '}
              <span className="font-semibold">{invite.groupName}</span>.
            </p>
            {error?.id === invite.ref.path && (
              <p className="mt-2 text-sm text-red-600">{error.message}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={inFlight}
                onClick={() => {
                  setPending(invite.ref.path);
                  setError(null);
                  acceptInvite(invite, user)
                    .catch(() =>
                      setError({
                        id: invite.ref.path,
                        message: 'Could not accept invite.',
                      }),
                    )
                    .finally(() => setPending(null));
                }}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={inFlight}
                onClick={() => {
                  setPending(invite.ref.path);
                  setError(null);
                  declineInvite(invite)
                    .catch(() =>
                      setError({
                        id: invite.ref.path,
                        message: 'Could not decline invite.',
                      }),
                    )
                    .finally(() => setPending(null));
                }}
                className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
