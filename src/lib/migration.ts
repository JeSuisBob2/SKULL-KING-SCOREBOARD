export function normalizeSpecialCards(
  specials: Record<string, unknown>
): Record<string, { positive: number; negative: number }> {
  const result: Record<string, { positive: number; negative: number }> = {};
  for (const [key, value] of Object.entries(specials ?? {})) {
    if (typeof value === 'number') {
      result[key] = { positive: value, negative: 0 };
    } else if (value && typeof value === 'object') {
      const obj = value as Record<string, number>;
      result[key] = {
        positive: obj.positive ?? 0,
        negative: obj.negative ?? 0,
      };
    } else {
      result[key] = { positive: 0, negative: 0 };
    }
  }
  return result;
}
