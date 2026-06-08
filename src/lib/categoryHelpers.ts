import type { CategoryDoc } from '../types/models';

export function filterAndSortCategories(docs: CategoryDoc[]): {
  all: CategoryDoc[];
  active: CategoryDoc[];
} {
  const sorted = [...docs].sort((a, b) => a.order - b.order);
  return {
    all: sorted,
    active: sorted.filter((c) => !c.archived),
  };
}
