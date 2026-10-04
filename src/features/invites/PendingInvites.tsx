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
    <div className="card divide-y divide-line overflow-hidden">
      {invites.map((invite) => {
        const inFlight = pending === invite.ref.path;
        return (
          <div
            key={invite.ref.path}
            className="p-4"
          >
            <p className="text-sm text-ink">
              <span className="font-semibold">{invite.invitedByName}</span>{' '}
              invited you to join{' '}
              <span className="font-semibold">{invite.groupName}</span>.
            </p>
            {error?.id === invite.ref.path && (
              <p className="mt-2 text-sm text-negative">{error.message}</p>
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
                className="btn-primary"
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
                className="btn-ghost border border-line disabled:opacity-50"
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
