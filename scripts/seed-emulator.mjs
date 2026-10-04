#!/usr/bin/env node
// Seeds the local Firebase emulators with a two-person household so the app
// has realistic data to look at (and screenshot) during UI work.
//
//   npm run emulators          # in one terminal (or the firebase-emulators launch entry)
//   npm run seed:emulator      # wipes Firestore + Auth, then seeds
//   npm run dev:emulator       # sign in as mike@example.com / password123
//
// Writes go through @firebase/rules-unit-testing with rules disabled, so the
// script never needs the real project's credentials.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, writeBatch } from 'firebase/firestore';

const PROJECT_ID = 'demo-spendshare';
const AUTH_HOST = 'http://127.0.0.1:9099';
const FIRESTORE = { host: '127.0.0.1', port: 8080 };
const PASSWORD = 'password123';
const GROUP_ID = 'hartley-house';

const PEOPLE = [
  { key: 'mike', email: 'mike@example.com', displayName: 'Mike' },
  { key: 'priya', email: 'priya@example.com', displayName: 'Priya' },
];

const CATEGORIES = ['Groceries', 'Dining', 'Transport', 'Utilities', 'Household', 'Entertainment', 'Health', 'Other'];

// [shop, category, payer, dayOfMonth, items: [name, cents, shared?, qty?, remark?], extras?]
const MONTH_TEMPLATES = [
  ['Woolworths', 'Groceries', 'mike', 3, [['Bananas', 412], ['Oat milk', 650, true, 1, 'Barista edition'], ['Sourdough', 780], ['Razors', 1599, false]]],
  ['Bunnings', 'Household', 'priya', 3, [['Potting mix', 1295], ['Hose fitting', 848]]],
  ['Thai Riffic', 'Dining', 'priya', 2, [['Pad see ew', 2290], ['Green curry', 2450]]],
  ['Origin Energy', 'Utilities', 'mike', 1, [['Electricity', 18735]]],
  ['Coles', 'Groceries', 'mike', 1, [['Chicken thighs', 1340], ['Rice 5kg', 1150], ['Detergent', 1475]], { giftCardAmount: 2000, discountPercent: 2 }],
  ['Event Cinemas', 'Entertainment', 'priya', 6, [['Tickets', 1900, true, 2], ['Popcorn', 1150]]],
  ['Opal top-up', 'Transport', 'mike', 8, [['Opal card', 4000]]],
  ['Chemist Warehouse', 'Health', 'priya', 9, [['Vitamins', 2499, false], ['Sunscreen', 1650]]],
];

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function authRequest(path, body) {
  const res = await fetch(`${AUTH_HOST}${path}`, {
    method: body ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Auth emulator ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createUsers() {
  await authRequest(`/emulator/v1/projects/${PROJECT_ID}/accounts`);
  const uids = {};
  for (const p of PEOPLE) {
    const { localId } = await authRequest('/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key', {
      email: p.email,
      password: PASSWORD,
      displayName: p.displayName,
    });
    // Mark verified so no "verify your email" flow gets in the way.
    await authRequest(`/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`, {
      localId,
      emailVerified: true,
    });
    uids[p.key] = localId;
  }
  return uids;
}

async function seedFirestore(db, uids) {
  const now = new Date();
  const created = new Date(now.getFullYear(), now.getMonth() - 3, 5);
  const ts = (d) => Timestamp.fromDate(d);

  for (const p of PEOPLE) {
    await setDoc(doc(db, 'users', uids[p.key]), {
      uid: uids[p.key], email: p.email, displayName: p.displayName,
      memberOf: [GROUP_ID], createdAt: ts(created),
    });
  }

  await setDoc(doc(db, 'groups', GROUP_ID), {
    id: GROUP_ID, name: 'Hartley House', currency: 'AUD', ownerUid: uids.mike,
    members: Object.fromEntries(PEOPLE.map((p, i) => [uids[p.key], {
      role: i === 0 ? 'owner' : 'member', displayName: p.displayName, email: p.email, joinedAt: ts(created),
    }])),
    memberUids: PEOPLE.map((p) => uids[p.key]),
    createdAt: ts(created),
  });

  const categoryIds = {};
  const catBatch = writeBatch(db);
  CATEGORIES.forEach((name, order) => {
    const id = `cat-${name.toLowerCase()}`;
    categoryIds[name] = id;
    catBatch.set(doc(db, `groups/${GROUP_ID}/categories/${id}`), { id, name, order, archived: false });
  });
  await catBatch.commit();

  // The current month and the two before it. In the current month, skip days
  // that haven't happened yet so nothing is dated in the future.
  let expenseCount = 0;
  for (let back = 0; back <= 2; back++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const month = monthKey(monthStart);
    const batch = writeBatch(db);
    MONTH_TEMPLATES.forEach(([shopName, category, payer, day, items, extras = {}], i) => {
      // Vary later months a little so their totals differ.
      const shiftedDay = Math.min(day + back * 4, 28);
      if (back === 0 && shiftedDay > now.getDate()) return;
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), shiftedDay, 12);
      const expenseId = `${month}-${i}`;
      const payerUid = uids[payer];
      const lines = items.map(([name, unit, shared = true, quantity = 1, remark]) => ({
        name, unit: unit + back * 37, shared, quantity, remark,
      }));
      const total = lines.reduce((s, l) => s + l.unit * l.quantity, 0);
      batch.set(doc(db, `groups/${GROUP_ID}/expenses/${expenseId}`), {
        groupId: GROUP_ID, date: ts(date), month, shopName, payerUid, total,
        itemCount: lines.length, createdByUid: payerUid, createdAt: ts(date), updatedAt: ts(date),
        ...extras,
      });
      lines.forEach((l, j) => {
        batch.set(doc(db, `groups/${GROUP_ID}/expenses/${expenseId}/items/item-${j}`), {
          groupId: GROUP_ID, expenseId, month, name: l.name,
          categoryId: categoryIds[category], category,
          amount: l.unit * l.quantity, quantity: l.quantity, unitAmount: l.unit,
          shared: l.shared, payerUid,
          ...(l.remark ? { remark: l.remark } : {}),
        });
      });
      expenseCount++;
    });
    // Income for both members.
    batch.set(doc(db, `groups/${GROUP_ID}/income/${month}_${uids.mike}_0`), { uid: uids.mike, month, amount: 520000, description: 'Salary' });
    batch.set(doc(db, `groups/${GROUP_ID}/income/${month}_${uids.priya}_0`), { uid: uids.priya, month, amount: 480000, description: 'Salary' });
    await batch.commit();
  }

  // Two months ago is settled, so the month list shows a mix of states.
  const settledMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  const settlementId = `${settledMonth}_${uids.priya}_${uids.mike}`;
  await setDoc(doc(db, `groups/${GROUP_ID}/settlements/${settlementId}`), {
    id: settlementId, month: settledMonth, fromUid: uids.priya, toUid: uids.mike,
    amount: 8829, paid: true, paidAt: ts(new Date(now.getFullYear(), now.getMonth() - 1, 2)), markedByUid: uids.mike,
  });

  return expenseCount;
}

const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE });
try {
  await env.clearFirestore();
  const uids = await createUsers();
  let expenses = 0;
  await env.withSecurityRulesDisabled(async (ctx) => {
    expenses = await seedFirestore(ctx.firestore(), uids);
  });
  console.log(`Seeded Hartley House: ${PEOPLE.length} members, ${expenses} expenses over 3 months.`);
  console.log(`Sign in as ${PEOPLE.map((p) => p.email).join(' or ')} with password "${PASSWORD}".`);
} finally {
  await env.cleanup();
}
