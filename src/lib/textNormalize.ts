export function collapseWhitespace(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function normalizeNameKey(name: string): string {
  return collapseWhitespace(name).toLocaleLowerCase();
}

/** Whether `name` is nothing but dots: as a path segment, "." and ".." would resolve somewhere else. */
export function isDotsOnly(name: string): boolean {
  return /^\.+$/.test(name);
}
