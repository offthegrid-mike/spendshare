import { writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { categoriesCol } from './converters';

const DEFAULTS = [
  'Groceries', 'Dining', 'Transport', 'Utilities',
  'Household', 'Entertainment', 'Health', 'Other',
];

export async function seedDefaultCategories(gid: string) {
  const batch = writeBatch(db);
  DEFAULTS.forEach((name, order) => {
    const ref = doc(categoriesCol(gid));
    batch.set(ref, { id: ref.id, name, order, archived: false });
  });
  await batch.commit();
}
