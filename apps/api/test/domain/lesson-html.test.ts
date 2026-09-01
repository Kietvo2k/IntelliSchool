import { describe, expect, it } from 'vitest';
import { sanitizeLessonHtml } from '../../src/domain/classroom/lesson-html.js';

describe('lesson HTML sanitization', () => {
  it('keeps only the approved lesson markup and safe links', () => {
    const html = sanitizeLessonHtml('<h2>Bài học</h2><p><strong>Quan trọng</strong> <a href="https://example.test" target="_blank" onclick="alert(1)">Xem thêm</a></p>');

    expect(html).toContain('<h2>Bài học</h2>');
    expect(html).toContain('<strong>Quan trọng</strong>');
    expect(html).toContain('href="https://example.test"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('onclick');
  });

  it('removes executable and embedded content rather than attempting regex cleanup', () => {
    const html = sanitizeLessonHtml('<script>alert(1)</script><iframe src="https://evil.test"></iframe><svg onload="alert(1)"><a href="javascript:alert(1)">X</a></svg><p style="color:red">An toàn</p>');

    expect(html).toBe('<p>An toàn</p>');
  });
});
