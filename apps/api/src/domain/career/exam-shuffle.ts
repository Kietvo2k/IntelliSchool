/** Permutation ổn định theo seed để xáo câu/đáp án theo lượt thi. */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  let state = seed >>> 0 || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    const current = copy[index]!;
    copy[index] = copy[swap]!;
    copy[swap] = current;
  }
  return copy;
}

export function seedFromUuid(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
