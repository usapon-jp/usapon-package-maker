export function parseNumberDraft(draft: string, min: number, max: number): number | null {
  if (draft.trim() === "") return null;

  const value = Number(draft);
  if (!Number.isFinite(value) || value < min || value > max) return null;

  return value;
}
