import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { getDoc, doc } from 'firebase/firestore';
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
