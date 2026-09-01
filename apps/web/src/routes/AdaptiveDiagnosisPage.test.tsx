import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdaptiveDiagnosisPage } from './AdaptiveDiagnosisPage.js';
import { MyLearningPathPage } from './MyLearningPathPage.js';

describe('Adaptive pages', () => {
  it('renders the teacher diagnosis workspace grouped by need', () => {
    const markup = renderToStaticMarkup(<AdaptiveDiagnosisPage />);
    expect(markup).toContain('Lớp học theo nhu cầu');
    expect(markup).toContain('mở được bằng chứng');
  });

  it('renders the student learning path with evidence-based framing', () => {
    const markup = renderToStaticMarkup(<MyLearningPathPage />);
    expect(markup).toContain('Lộ trình của em');
    expect(markup).toContain('Đang tải lộ trình');
  });
});
