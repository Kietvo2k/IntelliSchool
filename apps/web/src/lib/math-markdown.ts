/**
 * Providers commonly return KaTeX delimiters as \[...\] and \(...\).
 * remark-math parses the dollar delimiters, so normalize only the delimiters
 * and leave the LaTeX body untouched.
 */
export function normalizeMathDelimiters(value: string): string {
  return value
    .replace(/\\\[/g, () => '\n$$\n')
    .replace(/\\\]/g, () => '\n$$\n')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}
