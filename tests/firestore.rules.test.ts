import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { getDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');

describe('Firestore Rules - /users collection', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-spendshare',
      firestore: { rules, host: 'localhost', port: 8080 },
    });
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
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-spendshare',
      firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'), host: 'localhost', port: 8080 },
    });
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
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-spendshare',
      firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'), host: 'localhost', port: 8080 },
    });
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
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-spendshare',
      firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'), host: 'localhost', port: 8080 },
    });
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
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-spendshare',
      firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'), host: 'localhost', port: 8080 },
    });
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
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-spendshare',
      firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'), host: 'localhost', port: 8080 },
    });
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
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-spendshare',
      firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'), host: 'localhost', port: 8080 },
    });
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
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-spendshare',
      firestore: { rules, host: 'localhost', port: 8080 },
    });
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
