import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CareerGuidePage } from './CareerGuidePage.js';
import { ExamRoomPage } from './ExamRoomPage.js';

describe('career and exam surfaces', () => {
  it('explains the three subject layers', () => {
    const markup = renderToStaticMarkup(<CareerGuidePage />);
    expect(markup).toContain('Bắt đầu đúng cách');
    expect(markup).toContain('Tổ hợp xét tuyển');
  });

  it('renders the school mock exam gate without ministry impersonation', () => {
    const markup = renderToStaticMarkup(<ExamRoomPage />);
    expect(markup).toContain('thi thử của trường');
    expect(markup).not.toContain('Cục QLCL');
    expect(markup).not.toContain('SafeWebBrowser');
  });
});
