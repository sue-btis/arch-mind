// Chosen values stay visible so a search can never hide what is filtering the view.
export function searchValues<T extends string>(values: T[], selected: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return values;
  return values.filter((v) => selected.includes(v) || v.toLowerCase().includes(q));
}
