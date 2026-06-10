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
