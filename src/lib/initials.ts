/** The first letter of a name, uppercased, for avatars and tiles. */
export function initialOf(name: string): string {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}
