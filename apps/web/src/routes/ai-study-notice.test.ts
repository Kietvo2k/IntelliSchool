import { describe, expect, it } from 'vitest';
import { visibleAiStudyNotice } from './ai-study-notice.js';

describe('AI study success notice', () => {
  it('does not render provider diagnostics after a normal model response', () => {
    expect(visibleAiStudyNotice({ executionMode: 'MODEL', provider: 'OPENAI_COMPATIBLE', usedModel: 'deepseek-v4-flash', requestId: 'request-1' })).toBe('');
  });

  it('keeps an explicit safe server notice when one exists', () => {
    expect(visibleAiStudyNotice({ executionMode: 'MODEL', notice: 'Đã mở phiên mới.' })).toBe('Đã mở phiên mới.');
  });
});
