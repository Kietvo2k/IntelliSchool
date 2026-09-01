import { describe, expect, it } from 'vitest';
import { buildInterviewContext, presentInterviewTurn } from '../../src/domain/career/interview.js';

describe('career interview context', () => {
  it('builds a compact context from profile and prior answers', () => {
    const context = buildInterviewContext({ profile: { province: 'Cần Thơ', studyGoal: 'Công nghệ thông tin' }, answers: { ec_clubs: 'CLB robot', ec_sports: 'Bóng đá' } });
    expect(context).toContain('Cần Thơ');
    expect(context).toContain('ec_clubs');
  });

  it('exposes at most one follow-up question from model output', () => {
    expect(presentInterviewTurn('{"ask_followup":true,"question":"Em giữ vai trò gì?\\nEm đạt kết quả gì?","extracted_fields":{}}')).toBe('Em giữ vai trò gì?');
    expect(presentInterviewTurn('{"ask_followup":false,"extracted_fields":{}}')).toContain('Cảm ơn em');
  });
});
