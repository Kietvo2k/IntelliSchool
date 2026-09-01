import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CareerQuizPage } from './CareerQuizPage.js';

function render() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <CareerQuizPage />
    </MemoryRouter>,
  );
}

describe('CareerQuizPage', () => {
  it('renders Holland/RIASEC in the golden pathway with advisory framing', () => {
    const markup = render();
    expect(markup).toContain('Khám phá bản thân');
    expect(markup).toContain('Holland / RIASEC');
    expect(markup).toContain('chỉ để tham khảo');
    expect(markup).toContain('Lộ trình khám phá');
    expect(markup).not.toContain('Sở thích tự do');
  });

  it('describes the 20-question reasoning assessment instead of the retired 30-question split', () => {
    const markup = render();
    expect(markup).toContain('20 câu tư duy');
    expect(markup).not.toContain('15 tư duy + 15 đời sống');
  });


  it('lets the learner skip to the profile step from intro', () => {
    const markup = render();
    expect(markup).toContain('Bắt đầu');
    expect(markup).toContain('Bỏ qua tới hồ sơ');
    expect(markup).toContain('Giới thiệu');
    expect(markup).toContain('Năng lực');
    expect(markup).toContain('Hoạt động &amp; trải nghiệm');
    expect(markup).toContain('Điểm học');
    expect(markup).toContain('Hồ sơ');
  });
});
