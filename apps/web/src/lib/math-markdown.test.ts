import { describe, expect, it } from 'vitest';
import { normalizeMathDelimiters } from './math-markdown.js';

describe('normalizeMathDelimiters', () => {
  it('converts LaTeX bracket delimiters for remark-math', () => {
    const content = String.raw`\[ y = \frac{ax^3 + bx^2 + cx + d}{mx^2 + nx + p} \]`;
    const normalized = normalizeMathDelimiters(content);

    expect(normalized).toContain('$$');
    expect(normalized).toContain(String.raw`\frac`);
    expect(normalized).not.toContain(String.raw`\[`);
    expect(normalized).not.toContain(String.raw`\]`);
  });

  it('converts inline parenthesis delimiters without changing the formula body', () => {
    const content = String.raw`Đạo hàm \(x^2\) bằng \(2x\).`;

    expect(normalizeMathDelimiters(content)).toBe(String.raw`Đạo hàm $x^2$ bằng $2x$.`);
  });
});
