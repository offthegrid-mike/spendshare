export function collapseWhitespace(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function normalizeNameKey(name: string): string {
  return collapseWhitespace(name).toLocaleLowerCase();
}
