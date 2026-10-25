import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');

// Every rule requires a verified email on the allowlist. These are the emails
// the suites sign in with; initRulesEnv seeds them and re-seeds after a clear.
const ALLOWLISTED = ['usera@test.com', 'userb@test.com', 'userc@test.com', 'alicea@test.com', 'bob@test.com'];

async function seedAllowlist(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await Promise.all(ALLOWLISTED.map((email) => setDoc(doc(ctx.firestore(), 'allowlist', email), {})));
  });
}

// A test environment whose contexts sign in as `<uid>@test.com`, verified,
// unless the test passes its own email claims.
async function initRulesEnv(): Promise<RulesTestEnvironment> {
  const env = await initializeTestEnvironment({
    projectId: 'demo-spendshare',
    firestore: { rules, host: 'localhost', port: 8080 },
  });
  const clear = env.clearFirestore.bind(env);
  env.clearFirestore = async () => {
    await clear();
    await seedAllowlist(env);
  };
  const authenticated = env.authenticatedContext.bind(env);
  env.authenticatedContext = (uid, claims) =>
    authenticated(uid, { email: `${uid.toLowerCase()}@test.com`, email_verified: true, ...claims });
  await seedAllowlist(env);
  return env;
}

describe('Firestore Rules - sign-in allowlist', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initRulesEnv();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  const stranger = () => testEnv.authenticatedContext('stranger');

  it('denies a verified user who is not on the allowlist their own user document', async () => {
    await assertFails(getDoc(doc(stranger().firestore(), 'users', 'stranger')));
    await assertFails(setDoc(doc(stranger().firestore(), 'users', 'stranger'), { uid: 'stranger' }));
  });

  it('denies a user who is not on the allowlist creating a group', async () => {
    await assertFails(setDoc(doc(stranger().firestore(), 'groups', 'strangerGroup'), {
      ownerUid: 'stranger', name: 'Mine', currency: 'AUD',
      members: { stranger: { role: 'owner' } }, memberUids: ['stranger'],
    }));
  });

  it('denies an allowlisted email that is not verified', async () => {
    const unverified = testEnv.authenticatedContext('userA', { email_verified: false });
    await assertFails(getDoc(doc(unverified.firestore(), 'users', 'userA')));
  });

  it('allows an allowlisted, verified email whatever its case', async () => {
    const userA = testEnv.authenticatedContext('userA', { email: 'UserA@Test.com' });
    await assertSucceeds(getDoc(doc(userA.firestore(), 'users', 'userA')));
  });

  it('lets anyone signed in read their own allowlist entry, and only their own', async () => {
    await assertSucceeds(getDoc(doc(stranger().firestore(), 'allowlist', 'stranger@test.com')));
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('userA').firestore(), 'allowlist', 'usera@test.com')));
    await assertFails(getDoc(doc(stranger().firestore(), 'allowlist', 'usera@test.com')));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'allowlist', 'usera@test.com')));
  });

  it('never lets the app list or write the allowlist', async () => {
    const userA = testEnv.authenticatedContext('userA');
    await assertFails(getDocs(collection(userA.firestore(), 'allowlist')));
    await assertFails(setDoc(doc(stranger().firestore(), 'allowlist', 'stranger@test.com'), {}));
    await assertFails(setDoc(doc(userA.firestore(), 'allowlist', 'friend@test.com'), {}));
    await assertFails(deleteDoc(doc(userA.firestore(), 'allowlist', 'usera@test.com')));
  });
});

describe('Firestore Rules - /users collection', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initRulesEnv();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('denies reading another user document', async () => {
    const userA = testEnv.authenticatedContext('userA');
    await assertFails(getDoc(doc(userA.firestore(), 'users', 'userB')));
  });

  it('allows reading own user document', async () => {
    const userA = testEnv.authenticatedContext('userA');
    await assertSucceeds(getDoc(doc(userA.firestore(), 'users', 'userA')));
  });

  it('denies unauthenticated read', async () => {
    const unauth = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(unauth.firestore(), 'users', 'userA')));
  });
});

describe('Firestore Rules - /groups privilege escalation', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initRulesEnv();
    // Seed: group with ownerUid=userA, members={userA, userB}, memberUids=[userA, userB]
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'groups', 'group1'), {
        ownerUid: 'userA',
        name: 'Test Group',
        currency: 'USD',
        members: {
          userA: { uid: 'userA', name: 'Alice', email: 'alice@test.com', role: 'owner' },
          userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com', role: 'member' },
        },
        memberUids: ['userA', 'userB'],
        createdAt: new Date(),
      });
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('denies member changing ownerUid', async () => {
    const userB = testEnv.authenticatedContext('userB');
    await assertFails(updateDoc(doc(userB.firestore(), 'groups', 'group1'), { ownerUid: 'userB' }));
  });

  it('denies member rewriting members map', async () => {
    const userB = testEnv.authenticatedContext('userB');
    await assertFails(
      updateDoc(doc(userB.firestore(), 'groups', 'group1'), {
        members: { userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com' } },
        memberUids: ['userB'],
      })
    );
  });

  it('denies member rewriting memberUids array', async () => {
    const userB = testEnv.authenticatedContext('userB');
    await assertFails(
      updateDoc(doc(userB.firestore(), 'groups', 'group1'), { memberUids: ['userB'] })
    );
  });

  it('denies member deleting the group', async () => {
    const userB = testEnv.authenticatedContext('userB');
    await assertFails(deleteDoc(doc(userB.firestore(), 'groups', 'group1')));
  });

  it('allows member to update group name', async () => {
    const userB = testEnv.authenticatedContext('userB');
    await assertSucceeds(
      updateDoc(doc(userB.firestore(), 'groups', 'group1'), { name: 'Renamed Group' })
    );
  });

  it('allows member to update currency', async () => {
    const userB = testEnv.authenticatedContext('userB');
    await assertSucceeds(
      updateDoc(doc(userB.firestore(), 'groups', 'group1'), { currency: 'EUR' })
    );
  });

  it('allows owner to update ownerUid (ownership transfer)', async () => {
    const userA = testEnv.authenticatedContext('userA');
    // Owner can transfer ownership; after this, we reset for isolation
    await assertSucceeds(
      updateDoc(doc(userA.firestore(), 'groups', 'group1'), { ownerUid: 'userA' })
    );
  });

  it('allows owner to add/remove members (members map + memberUids)', async () => {
    const userA = testEnv.authenticatedContext('userA');
    await assertSucceeds(
      updateDoc(doc(userA.firestore(), 'groups', 'group1'), {
        'members.userC': { uid: 'userC', name: 'Carol', email: 'carol@test.com', role: 'member' },
        memberUids: ['userA', 'userB', 'userC'],
      })
    );
  });
});

describe('/groups invite-accept takeover prevention', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initRulesEnv();
    // Seed: group2 with ownerUid=userA, members={userA, userB}, memberUids=[userA, userB]
    // and a pending invite for userc@test.com
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'groups', 'group2'), {
        ownerUid: 'userA',
        name: 'Takeover Test Group',
        currency: 'USD',
        members: {
          userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com' },
          userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com' },
        },
        memberUids: ['userA', 'userB'],
        createdAt: new Date(),
      });
      await setDoc(doc(db, 'groups', 'group2', 'invites', 'userc@test.com'), {
        status: 'pending',
        email: 'userc@test.com',
        groupId: 'group2',
      });
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('denies invite-accept that evicts existing members', async () => {
    // userC wipes userA and userB, sets only themselves
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertFails(updateDoc(doc(userC.firestore(), 'groups', 'group2'), {
      members: { userC: { uid: 'userC', name: 'Carol', email: 'userc@test.com' } },
      memberUids: ['userC']
    }));
  });

  it('allows invite-accept that preserves existing members', async () => {
    // userC adds themselves while keeping userA and userB
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertSucceeds(updateDoc(doc(userC.firestore(), 'groups', 'group2'), {
      members: {
        userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com' },
        userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com' },
        userC: { uid: 'userC', name: 'Carol', email: 'userc@test.com', role: 'member' }
      },
      memberUids: ['userA', 'userB', 'userC']
    }));
  });
});

describe('/groups invite-accept arbitrary-UID injection (H-1)', () => {
  let testEnv: RulesTestEnvironment;

  beforeEach(async () => {
    testEnv = await initRulesEnv();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'groups', 'group3'), {
        ownerUid: 'userA',
        name: 'Injection Test Group',
        currency: 'USD',
        members: {
          userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com', role: 'owner' },
          userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com', role: 'member' },
        },
        memberUids: ['userA', 'userB'],
        createdAt: new Date(),
      });
      await setDoc(doc(db, 'groups', 'group3', 'invites', 'userc@test.com'), {
        status: 'pending',
        email: 'userc@test.com',
        groupId: 'group3',
      });
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('denies accept that adds a UID other than the caller to memberUids', async () => {
    // userC has a valid pending invite, but injects attackerX into memberUids
    // while only putting themselves in the members map.
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertFails(updateDoc(doc(userC.firestore(), 'groups', 'group3'), {
      members: {
        userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com', role: 'owner' },
        userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com', role: 'member' },
        userC: { uid: 'userC', name: 'Carol', email: 'userc@test.com', role: 'member' },
      },
      // adds attackerX (not the caller) as the single new memberUids element
      memberUids: ['userA', 'userB', 'attackerX'],
    }));
  });

  it('denies accept that adds extra keys to the members map', async () => {
    // userC adds both themselves and an arbitrary attackerX to the members map.
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertFails(updateDoc(doc(userC.firestore(), 'groups', 'group3'), {
      members: {
        userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com', role: 'owner' },
        userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com', role: 'member' },
        userC: { uid: 'userC', name: 'Carol', email: 'userc@test.com', role: 'member' },
        attackerX: { uid: 'attackerX', name: 'Mallory', email: 'mallory@test.com', role: 'member' },
      },
      memberUids: ['userA', 'userB', 'userC'],
    }));
  });

  it('denies accept that pins the new member role to owner', async () => {
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertFails(updateDoc(doc(userC.firestore(), 'groups', 'group3'), {
      members: {
        userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com', role: 'owner' },
        userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com', role: 'member' },
        userC: { uid: 'userC', name: 'Carol', email: 'userc@test.com', role: 'owner' },
      },
      memberUids: ['userA', 'userB', 'userC'],
    }));
  });

  it("denies accept that rewrites an existing member's entry", async () => {
    // Keys are preserved, but the owner's name/email are tampered with.
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertFails(updateDoc(doc(userC.firestore(), 'groups', 'group3'), {
      members: {
        userA: { uid: 'userA', name: 'Hacked', email: 'attacker@test.com', role: 'owner' },
        userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com', role: 'member' },
        userC: { uid: 'userC', name: 'Carol', email: 'userc@test.com', role: 'member' },
      },
      memberUids: ['userA', 'userB', 'userC'],
    }));
  });

  it("denies accept that changes an existing member's role", async () => {
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertFails(updateDoc(doc(userC.firestore(), 'groups', 'group3'), {
      members: {
        userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com', role: 'member' },
        userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com', role: 'owner' },
        userC: { uid: 'userC', name: 'Carol', email: 'userc@test.com', role: 'member' },
      },
      memberUids: ['userA', 'userB', 'userC'],
    }));
  });

  it('allows a dotted-path accept, as the app writes it', async () => {
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertSucceeds(updateDoc(doc(userC.firestore(), 'groups', 'group3'), {
      'members.userC': { uid: 'userC', name: 'Carol', email: 'userc@test.com', role: 'member' },
      memberUids: ['userA', 'userB', 'userC'],
    }));
  });

  it('allows a clean accept that adds only the caller as a member', async () => {
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertSucceeds(updateDoc(doc(userC.firestore(), 'groups', 'group3'), {
      members: {
        userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com', role: 'owner' },
        userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com', role: 'member' },
        userC: { uid: 'userC', name: 'Carol', email: 'userc@test.com', role: 'member' },
      },
      memberUids: ['userA', 'userB', 'userC'],
    }));
  });
});

describe('/groups/{id}/invites invitee write transitions (M-1)', () => {
  let testEnv: RulesTestEnvironment;

  beforeEach(async () => {
    testEnv = await initRulesEnv();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'groups', 'group4'), {
        ownerUid: 'userA',
        name: 'Invite State Group',
        currency: 'USD',
        members: { userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com', role: 'owner' } },
        memberUids: ['userA'],
        createdAt: new Date(),
      });
      // A revoked invite for userc@test.com
      await setDoc(doc(db, 'groups', 'group4', 'invites', 'userc@test.com'), {
        status: 'revoked',
        email: 'userc@test.com',
        groupId: 'group4',
      });
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('denies invitee resurrecting a revoked invite back to pending', async () => {
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertFails(updateDoc(doc(userC.firestore(), 'groups', 'group4', 'invites', 'userc@test.com'), {
      status: 'pending',
    }));
  });

  it('allows invitee declining their own invite', async () => {
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertSucceeds(updateDoc(doc(userC.firestore(), 'groups', 'group4', 'invites', 'userc@test.com'), {
      status: 'declined',
    }));
  });

  it('allows a group member (owner) to revoke an invite back/forth', async () => {
    const userA = testEnv.authenticatedContext('userA', { email: 'alicea@test.com', email_verified: true });
    await assertSucceeds(updateDoc(doc(userA.firestore(), 'groups', 'group4', 'invites', 'userc@test.com'), {
      status: 'pending',
    }));
  });
});

describe('/groups invites email_verified gating (L-1)', () => {
  let testEnv: RulesTestEnvironment;

  beforeEach(async () => {
    testEnv = await initRulesEnv();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'groups', 'group5'), {
        ownerUid: 'userA',
        name: 'Verify Group',
        currency: 'USD',
        members: { userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com', role: 'owner' } },
        memberUids: ['userA'],
        createdAt: new Date(),
      });
      await setDoc(doc(db, 'groups', 'group5', 'invites', 'userc@test.com'), {
        status: 'pending',
        email: 'userc@test.com',
        groupId: 'group5',
      });
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('denies unverified-email invitee reading their nested invite doc', async () => {
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: false });
    await assertFails(getDoc(doc(userC.firestore(), 'groups', 'group5', 'invites', 'userc@test.com')));
  });

  it('denies unverified-email invitee writing their nested invite doc', async () => {
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: false });
    await assertFails(updateDoc(doc(userC.firestore(), 'groups', 'group5', 'invites', 'userc@test.com'), {
      status: 'declined',
    }));
  });

  it('allows verified-email invitee reading their nested invite doc', async () => {
    const userC = testEnv.authenticatedContext('userC', { email: 'userc@test.com', email_verified: true });
    await assertSucceeds(getDoc(doc(userC.firestore(), 'groups', 'group5', 'invites', 'userc@test.com')));
  });
});

describe('/groups financial sub-collection validation (M-2)', () => {
  let testEnv: RulesTestEnvironment;

  beforeEach(async () => {
    testEnv = await initRulesEnv();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'groups', 'group6'), {
        ownerUid: 'userA',
        name: 'Finance Group',
        currency: 'USD',
        members: {
          userA: { uid: 'userA', name: 'Alice', email: 'alicea@test.com', role: 'owner' },
          userB: { uid: 'userB', name: 'Bob', email: 'bob@test.com', role: 'member' },
        },
        memberUids: ['userA', 'userB'],
        createdAt: new Date(),
      });
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  // --- Income author binding (auto-generated IDs) ---
  it('allows a member creating their own income with auto-ID (uid field matches)', async () => {
    const userB = testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true });
    await assertSucceeds(setDoc(doc(userB.firestore(), 'groups', 'group6', 'income', 'randomAutoId1'), {
      uid: 'userB', month: '2026-06', amount: 500000, description: 'Salary',
    }));
  });

  it('denies creating income when data.uid does not match auth uid', async () => {
    const userB = testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true });
    await assertFails(setDoc(doc(userB.firestore(), 'groups', 'group6', 'income', 'randomAutoId2'), {
      uid: 'userA', month: '2026-06', amount: 500000,
    }));
  });

  it('denies income with negative amount', async () => {
    const userB = testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true });
    await assertFails(setDoc(doc(userB.firestore(), 'groups', 'group6', 'income', 'randomAutoId3'), {
      uid: 'userB', month: '2026-06', amount: -100,
    }));
  });

  it("denies a member overwriting another member's existing income doc (update hijack)", async () => {
    // Seed an income doc owned by userA.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', 'group6', 'income', 'incomeA'), {
        uid: 'userA', month: '2026-06', amount: 500000,
      });
    });
    // userB tries to overwrite userA's doc, claiming it as their own income.
    const userB = testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true });
    await assertFails(setDoc(doc(userB.firestore(), 'groups', 'group6', 'income', 'incomeA'), {
      uid: 'userB', month: '2026-06', amount: 999999,
    }));
  });

  it('allows a member updating their own existing income doc', async () => {
    // Seed an income doc owned by userB.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', 'group6', 'income', 'incomeB'), {
        uid: 'userB', month: '2026-06', amount: 400000,
      });
    });
    const userB = testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true });
    await assertSucceeds(updateDoc(doc(userB.firestore(), 'groups', 'group6', 'income', 'incomeB'), {
      amount: 450000,
    }));
  });

  // --- Expense numeric checks ---
  describe('refunds', () => {
    const expense = (extra: Record<string, unknown>) => ({
      groupId: 'group6', month: '2026-06', shopName: 'Shop', payerUid: 'userA',
      total: 500, itemCount: 1, createdByUid: 'userB', ...extra,
    });
    const item = (extra: Record<string, unknown>) => ({
      groupId: 'group6', expenseId: 'r1', month: '2026-06', name: 'Milk', categoryId: 'c', category: 'C',
      amount: 500, shared: true, payerUid: 'userA', ...extra,
    });
    const bob = () => testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true }).firestore();

    it('allows a refund linked to its original, with refund items', async () => {
      await assertSucceeds(setDoc(doc(bob(), 'groups', 'group6', 'expenses', 'r1'), expense({ kind: 'refund', refundOf: 'e1' })));
      await assertSucceeds(setDoc(doc(bob(), 'groups', 'group6', 'expenses', 'r1', 'items', 'i1'), item({ refund: true })));
    });

    it('denies an unknown expense kind', async () => {
      await assertFails(setDoc(doc(bob(), 'groups', 'group6', 'expenses', 'r1'), expense({ kind: 'gift', refundOf: 'e1' })));
    });

    it('denies a refund that does not name its original', async () => {
      await assertFails(setDoc(doc(bob(), 'groups', 'group6', 'expenses', 'r1'), expense({ kind: 'refund' })));
      await assertFails(setDoc(doc(bob(), 'groups', 'group6', 'expenses', 'r1'), expense({ kind: 'refund', refundOf: 7 })));
    });

    it('denies refundOf on an expense that is not a refund', async () => {
      await assertFails(setDoc(doc(bob(), 'groups', 'group6', 'expenses', 'r1'), expense({ refundOf: 'e1' })));
    });

    it('denies a gift card on a refund', async () => {
      await assertFails(setDoc(doc(bob(), 'groups', 'group6', 'expenses', 'r1'), expense({ kind: 'refund', refundOf: 'e1', giftCardAmount: 100 })));
    });

    it('denies an item refund flag that is not a boolean', async () => {
      await assertFails(setDoc(doc(bob(), 'groups', 'group6', 'expenses', 'r1', 'items', 'i1'), item({ refund: 'yes' })));
    });
  });

  it('denies expense with negative total', async () => {
    const userB = testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true });
    await assertFails(setDoc(doc(userB.firestore(), 'groups', 'group6', 'expenses', 'exp1'), {
      groupId: 'group6', month: '2026-06', shopName: 'Shop', payerUid: 'userA',
      total: -50, itemCount: 1, createdByUid: 'userB',
    }));
  });

  it('denies expense whose createdByUid is another member', async () => {
    const userB = testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true });
    await assertFails(setDoc(doc(userB.firestore(), 'groups', 'group6', 'expenses', 'exp1'), {
      groupId: 'group6', month: '2026-06', shopName: 'Shop', payerUid: 'userA',
      total: 100, itemCount: 1, createdByUid: 'userA',
    }));
  });

  it('allows a valid expense (payerUid may be another member)', async () => {
    const userB = testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true });
    await assertSucceeds(setDoc(doc(userB.firestore(), 'groups', 'group6', 'expenses', 'exp1'), {
      groupId: 'group6', month: '2026-06', shopName: 'Shop', payerUid: 'userA',
      total: 100, itemCount: 1, createdByUid: 'userB',
    }));
  });

  // --- Settlement numeric checks ---
  it('denies settlement with negative amount', async () => {
    const userB = testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true });
    await assertFails(setDoc(doc(userB.firestore(), 'groups', 'group6', 'settlements', '2026-06_userA_userB'), {
      id: '2026-06_userA_userB', month: '2026-06', fromUid: 'userA', toUid: 'userB',
      amount: -100, paid: true, markedByUid: 'userB',
    }));
  });

  it('allows a valid settlement', async () => {
    const userB = testEnv.authenticatedContext('userB', { email: 'bob@test.com', email_verified: true });
    await assertSucceeds(setDoc(doc(userB.firestore(), 'groups', 'group6', 'settlements', '2026-06_userA_userB'), {
      id: '2026-06_userA_userB', month: '2026-06', fromUid: 'userA', toUid: 'userB',
      amount: 100, paid: true, markedByUid: 'userB',
    }));
  });
});

describe('/groups create (a second group)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initRulesEnv();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', 'home'), {
        ownerUid: 'userA',
        name: 'Home',
        currency: 'AUD',
        members: { userA: { role: 'owner', displayName: 'Alice', email: 'alice@test.com' } },
        memberUids: ['userA'],
        createdAt: new Date(),
      });
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  const newGroup = {
    id: '',
    name: 'Trip',
    currency: 'AUD',
    ownerUid: 'userA',
    members: { userA: { role: 'owner', displayName: 'Alice', email: 'alice@test.com', joinedAt: new Date() } },
    memberUids: ['userA'],
    createdAt: new Date(),
  };

  it('allows a member of one group to create a second group they own', async () => {
    const userA = testEnv.authenticatedContext('userA');
    await assertSucceeds(setDoc(doc(userA.firestore(), 'groups', 'trip'), newGroup));
  });

  it('allows the new owner to seed categories in the new group', async () => {
    const userA = testEnv.authenticatedContext('userA');
    await assertSucceeds(
      setDoc(doc(userA.firestore(), 'groups', 'trip', 'categories', 'c1'), {
        id: 'c1', name: 'Groceries', order: 0, archived: false,
      }),
    );
  });
});

describe('Firestore Rules - Work', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initRulesEnv();
  });

  afterAll(async () => {
    await testEnv.clearFirestore();
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  const DAY = '2026-10-12';
  const at = Timestamp.fromMillis(Date.UTC(2026, 9, 12, 1, 0));

  const revision = (overrides: Record<string, unknown> = {}) => ({
    at, kind: 'save', type: 'home', startTime: '09:00', finishTime: '17:00', minutes: 480,
    addedLater: false, countedInClaim: true, finishConfirmed: true, ...overrides,
  });

  // A valid first-save document: exactly one revision.
  const validDay = (overrides: Record<string, unknown> = {}) => ({
    date: DAY, incomeYear: '2026-27', type: 'home',
    startTime: '09:00', finishTime: '17:00', minutes: 480,
    addedLater: false, countedInClaim: true, finishConfirmed: true,
    finishConfirmedAt: at, firstRecordedAt: at, recordedAt: at, syncedAt: at,
    revisions: [revision()], ...overrides,
  });

  // Office, Leave and cleared days carry no times; undefined values are not allowed in a write.
  const withoutTimes = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !['startTime', 'finishTime', 'minutes'].includes(k)));
  const dayWithoutTimes = (type: string | null) =>
    withoutTimes(validDay({ type, revisions: [withoutTimes(revision({ type }))] }));

  // A first save as the writer sends it in a merge: placeholders for the server time and the revision.
  const firstSave = () => ({
    date: DAY, incomeYear: '2026-27', type: 'home',
    startTime: '09:00', finishTime: '17:00', minutes: 480,
    addedLater: false, countedInClaim: true, finishConfirmed: true,
    finishConfirmedAt: at, firstRecordedAt: at, recordedAt: at,
    syncedAt: serverTimestamp(),
    revisions: arrayUnion(revision()),
  });

  const dayRef = (db: Firestore, uid = 'userA', day = DAY) => doc(db, 'users', uid, 'workDays', day);
  const settingsRef = (db: Firestore, uid = 'userA', id = 'main') => doc(db, 'users', uid, 'workSettings', id);

  const seedDay = async (data: Record<string, unknown> = validDay(), uid = 'userA', day = DAY) => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(dayRef(ctx.firestore(), uid, day), data);
    });
  };

  const seedSettings = async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(settingsRef(ctx.firestore()), {
        workWeekdays: [1, 2, 3, 4, 5], defaultMinutes: 480, ratesCentsPerHour: { '2026-27': 70 },
        trackingStartDate: null,
      });
    });
  };

  describe('workDays access', () => {
    it('allows the owner to create a day with one revision', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(setDoc(dayRef(userA.firestore()), validDay()));
    });

    it('allows the owner to read their own day', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(getDoc(dayRef(userA.firestore())));
    });

    it('denies another signed-in user reading the day', async () => {
      await seedDay();
      const userB = testEnv.authenticatedContext('userB');
      await assertFails(getDoc(dayRef(userB.firestore())));
    });

    it('denies another signed-in user creating a day under the owner', async () => {
      const userB = testEnv.authenticatedContext('userB');
      await assertFails(setDoc(dayRef(userB.firestore(), 'userA'), validDay()));
    });

    it('denies another signed-in user appending a revision', async () => {
      await seedDay();
      const userB = testEnv.authenticatedContext('userB');
      await assertFails(
        updateDoc(dayRef(userB.firestore(), 'userA'), { revisions: arrayUnion(revision({ kind: 'confirm' })) }),
      );
    });

    it('denies an unauthenticated client reading the day', async () => {
      await seedDay();
      const unauth = testEnv.unauthenticatedContext();
      await assertFails(getDoc(dayRef(unauth.firestore(), 'userA')));
    });

    it('denies an unauthenticated client creating a day', async () => {
      const unauth = testEnv.unauthenticatedContext();
      await assertFails(setDoc(dayRef(unauth.firestore(), 'userA'), validDay()));
    });
  });

  describe('workDays revisions', () => {
    it('denies a first save with no revision', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(dayRef(userA.firestore()), validDay({ revisions: [] })));
    });

    it('denies a first save with two revisions', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(
        setDoc(dayRef(userA.firestore()), validDay({ revisions: [revision(), revision({ kind: 'confirm' })] })),
      );
    });

    it('allows an update that appends exactly one revision', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(
        updateDoc(dayRef(userA.firestore()), {
          type: 'office', minutes: deleteField(), startTime: deleteField(), finishTime: deleteField(),
          syncedAt: serverTimestamp(),
          revisions: arrayUnion(withoutTimes(revision({ kind: 'save', type: 'office' }))),
        }),
      );
    });

    it('denies an update that appends no revision', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(updateDoc(dayRef(userA.firestore()), { addedLater: true, syncedAt: serverTimestamp() }));
    });

    it('denies an update that appends two revisions', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(
        updateDoc(dayRef(userA.firestore()), {
          revisions: arrayUnion(revision({ kind: 'confirm' }), revision({ kind: 'include' })),
        }),
      );
    });

    it('denies an update that rewrites an earlier revision', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(
        updateDoc(dayRef(userA.firestore()), {
          revisions: [revision({ minutes: 1 }), revision({ kind: 'confirm' })],
        }),
      );
    });

    it('denies an update that drops the revision history', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(updateDoc(dayRef(userA.firestore()), { revisions: [revision({ kind: 'confirm' })] }));
    });

    it('denies deleting a day', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(deleteDoc(dayRef(userA.firestore())));
    });
  });

  describe('workDays batched merge writes as the app sends them', () => {
    it('allows a first merge save with a server timestamp and one arrayUnion revision', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(setDoc(dayRef(userA.firestore()), firstSave(), { merge: true }));
    });

    it('allows a later merge save that appends one revision', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(
        setDoc(
          dayRef(userA.firestore()),
          {
            date: DAY, incomeYear: '2026-27', type: 'office', startTime: deleteField(), finishTime: deleteField(),
            minutes: deleteField(), addedLater: false, countedInClaim: true, finishConfirmed: false,
            finishConfirmedAt: deleteField(), recordedAt: at, syncedAt: serverTimestamp(),
            revisions: arrayUnion(withoutTimes(revision({ type: 'office', finishConfirmed: false }))),
          },
          { merge: true },
        ),
      );
    });

    it('allows a cleared day (type null)', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(
        setDoc(
          dayRef(userA.firestore()),
          {
            date: DAY, type: null, startTime: deleteField(), finishTime: deleteField(), minutes: deleteField(),
            addedLater: false, countedInClaim: false, finishConfirmed: false, syncedAt: serverTimestamp(),
            revisions: arrayUnion(withoutTimes(revision({ kind: 'save', type: null, countedInClaim: false, finishConfirmed: false }))),
          },
          { merge: true },
        ),
      );
    });

    it('denies a merge save that appends a second revision in the same write', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(
        setDoc(
          dayRef(userA.firestore()),
          { revisions: arrayUnion(revision({ kind: 'confirm' }), revision({ kind: 'include' })) },
          { merge: true },
        ),
      );
    });
  });

  describe('workDays and settings written in one batch, as the app sends the first day', () => {
    // Reads a document with the rules off, so a denied write can be seen to have left nothing behind.
    const exists = async (pick: (db: Firestore) => ReturnType<typeof doc>) => {
      let found = false;
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        found = (await getDoc(pick(ctx.firestore()))).exists();
      });
      return found;
    };

    it('allows a first day save and the tracking start date together, and both documents exist', async () => {
      const userA = testEnv.authenticatedContext('userA');
      const db = userA.firestore();
      const batch = writeBatch(db);
      batch.set(dayRef(db), firstSave(), { merge: true });
      batch.set(settingsRef(db), { trackingStartDate: DAY }, { merge: true });

      await assertSucceeds(batch.commit());

      expect(await exists((d) => dayRef(d))).toBe(true);
      expect(await exists((d) => settingsRef(d))).toBe(true);
    });

    it('denies the whole batch when the tracking start date is invalid, leaving no day behind', async () => {
      const userA = testEnv.authenticatedContext('userA');
      const db = userA.firestore();
      const batch = writeBatch(db);
      batch.set(dayRef(db), firstSave(), { merge: true });
      batch.set(settingsRef(db), { trackingStartDate: 'yesterday' }, { merge: true });

      await assertFails(batch.commit());

      expect(await exists((d) => dayRef(d))).toBe(false);
      expect(await exists((d) => settingsRef(d))).toBe(false);
    });

    it.each(['office', 'leave'])(
      'allows a first %s save that deletes the time fields on a document that does not exist yet',
      async (type) => {
        const userA = testEnv.authenticatedContext('userA');
        await assertSucceeds(
          setDoc(
            dayRef(userA.firestore()),
            {
              date: DAY, incomeYear: '2026-27', type,
              startTime: deleteField(), finishTime: deleteField(), minutes: deleteField(),
              addedLater: false, countedInClaim: false, finishConfirmed: false,
              finishConfirmedAt: deleteField(), firstRecordedAt: at, recordedAt: at,
              syncedAt: serverTimestamp(),
              revisions: arrayUnion(withoutTimes(revision({ type, countedInClaim: false, finishConfirmed: false }))),
            },
            { merge: true },
          ),
        );
        expect(await exists((d) => dayRef(d))).toBe(true);
      },
    );
  });

  describe('workDays revisions must be a list', () => {
    it.each([['a string', 'x'], ['a map', { at: 1 }]])('denies a first save with revisions as %s', async (_label, value) => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(dayRef(userA.firestore()), validDay({ revisions: value })));
    });

    it('denies an update that replaces the revisions with a string', async () => {
      await seedDay(validDay({ revisions: [] }));
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(updateDoc(dayRef(userA.firestore()), { revisions: 'x', syncedAt: serverTimestamp() }));
    });
  });

  describe('workDays field validation', () => {
    it('denies type "remote"', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(dayRef(userA.firestore()), validDay({ type: 'remote' })));
    });

    it.each(['home', 'office', 'leave'])('allows type "%s"', async (type) => {
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(
        setDoc(dayRef(userA.firestore()), dayWithoutTimes(type)),
      );
    });

    it('allows type null (a cleared day)', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(
        setDoc(dayRef(userA.firestore()), dayWithoutTimes(null)),
      );
    });

    it('denies minutes of 0', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(dayRef(userA.firestore()), validDay({ minutes: 0 })));
    });

    it('denies minutes of 1441', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(dayRef(userA.firestore()), validDay({ minutes: 1441 })));
    });

    it('denies fractional minutes', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(dayRef(userA.firestore()), validDay({ minutes: 480.5 })));
    });

    it.each([1, 1440])('allows minutes of %i', async (minutes) => {
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(setDoc(dayRef(userA.firestore()), validDay({ minutes })));
    });

    it('denies a non-boolean addedLater', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(dayRef(userA.firestore()), validDay({ addedLater: 'no' })));
    });

    it('denies a non-boolean countedInClaim', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(dayRef(userA.firestore()), validDay({ countedInClaim: 1 })));
    });

    it('denies a non-boolean finishConfirmed', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(dayRef(userA.firestore()), validDay({ finishConfirmed: 'yes' })));
    });

    it('denies an update that sets an invalid type even when it appends one revision', async () => {
      await seedDay();
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(
        updateDoc(dayRef(userA.firestore()), {
          type: 'remote', revisions: arrayUnion(revision({ kind: 'confirm' })),
        }),
      );
    });

    it('denies a date field that differs from the document id', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(dayRef(userA.firestore()), validDay({ date: '2026-10-13' })));
    });

    it('denies a document id that is not a date', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(
        setDoc(dayRef(userA.firestore(), 'userA', 'not-a-date'), validDay({ date: 'not-a-date' })),
      );
    });
  });

  describe('workSettings', () => {
    const validSettings = (overrides: Record<string, unknown> = {}) => ({
      workWeekdays: [1, 2, 3, 4, 5], defaultMinutes: 480, ratesCentsPerHour: { '2026-27': 70 },
      trackingStartDate: null, ...overrides,
    });

    it('allows the owner to write workSettings/main', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(setDoc(settingsRef(userA.firestore()), validSettings(), { merge: true }));
    });

    it('allows the owner to merge a partial update into existing settings', async () => {
      await seedSettings();
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(setDoc(settingsRef(userA.firestore()), { defaultMinutes: 450 }, { merge: true }));
    });

    it('allows the owner to read workSettings/main', async () => {
      await seedSettings();
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(getDoc(settingsRef(userA.firestore())));
    });

    it('denies another signed-in user reading the settings', async () => {
      await seedSettings();
      const userB = testEnv.authenticatedContext('userB');
      await assertFails(getDoc(settingsRef(userB.firestore(), 'userA')));
    });

    it('denies another signed-in user writing the settings', async () => {
      const userB = testEnv.authenticatedContext('userB');
      await assertFails(setDoc(settingsRef(userB.firestore(), 'userA'), validSettings(), { merge: true }));
    });

    it('denies an unauthenticated client reading or writing the settings', async () => {
      await seedSettings();
      const unauth = testEnv.unauthenticatedContext();
      await assertFails(getDoc(settingsRef(unauth.firestore(), 'userA')));
      await assertFails(setDoc(settingsRef(unauth.firestore(), 'userA'), validSettings(), { merge: true }));
    });

    it('denies a workWeekdays entry of 8', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(settingsRef(userA.firestore()), validSettings({ workWeekdays: [1, 2, 8] }), { merge: true }));
    });

    it('denies a workWeekdays entry of 0', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(settingsRef(userA.firestore()), validSettings({ workWeekdays: [0, 1] }), { merge: true }));
    });

    it('denies defaultMinutes of 0 and 1441', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(settingsRef(userA.firestore()), validSettings({ defaultMinutes: 0 }), { merge: true }));
      await assertFails(setDoc(settingsRef(userA.firestore()), validSettings({ defaultMinutes: 1441 }), { merge: true }));
    });

    it('denies a document id other than main', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(settingsRef(userA.firestore(), 'userA', 'other'), validSettings(), { merge: true }));
    });

    it('denies deleting the settings', async () => {
      await seedSettings();
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(deleteDoc(settingsRef(userA.firestore())));
    });

    it('allows trackingStartDate null', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(setDoc(settingsRef(userA.firestore()), validSettings({ trackingStartDate: null }), { merge: true }));
    });

    it('allows trackingStartDate as a YYYY-MM-DD string', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(setDoc(settingsRef(userA.firestore()), validSettings({ trackingStartDate: '2026-10-12' }), { merge: true }));
    });

    it('allows the start-date-only merge the first day save sends', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(setDoc(settingsRef(userA.firestore()), { trackingStartDate: '2026-10-12' }, { merge: true }));
    });

    it('denies trackingStartDate "yesterday"', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(settingsRef(userA.firestore()), validSettings({ trackingStartDate: 'yesterday' }), { merge: true }));
    });

    it('denies trackingStartDate with a time part', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(settingsRef(userA.firestore()), validSettings({ trackingStartDate: '2026-10-12T00:00' }), { merge: true }));
    });

    it('denies ratesCentsPerHour that is not a map', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(settingsRef(userA.firestore()), { ratesCentsPerHour: 5 }, { merge: true }));
      await assertFails(setDoc(settingsRef(userA.firestore()), { ratesCentsPerHour: [70] }, { merge: true }));
    });

    it.each([[{}], [{ '2026-27': 70 }]])('allows ratesCentsPerHour of %j', async (rates) => {
      const userA = testEnv.authenticatedContext('userA');
      await assertSucceeds(setDoc(settingsRef(userA.firestore()), { ratesCentsPerHour: rates }, { merge: true }));
    });

    it('denies a numeric trackingStartDate', async () => {
      const userA = testEnv.authenticatedContext('userA');
      await assertFails(setDoc(settingsRef(userA.firestore()), validSettings({ trackingStartDate: 20261012 }), { merge: true }));
    });
  });
});
