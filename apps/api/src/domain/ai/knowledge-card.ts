export interface CanonicalKnowledge {
  strengths: string[];
  gaps: string[];
  recommendedFocus: string[];
  grades: Record<string, number>;
}

const FREE_TEXT_CAP = 800;

export function clampKnowledgeFreeText(text: string): string {
  return text.trim().slice(0, FREE_TEXT_CAP);
}

/** 80% canonical do backend chuẩn hóa từ điểm/học bạ; 20% free text do học sinh. */
export function normalizeKnowledgeCard(input: {
  grades: Record<string, number>;
  riasecCode?: string;
  extras?: Record<string, string>;
  freeText?: string;
}): { canonical: CanonicalKnowledge; freeText: string } {
  const grades = Object.fromEntries(Object.entries(input.grades).filter(([, score]) => Number.isFinite(score)));
  const ranked = Object.entries(grades).sort((left, right) => right[1] - left[1]);
  const strengths = ranked.filter(([, score]) => score >= 8).slice(0, 4).map(([code]) => code);
  const gaps = ranked.filter(([, score]) => score < 6.5).slice(-4).map(([code]) => code);
  const recommendedFocus = gaps.length ? gaps.slice(0, 3) : ranked.slice(-2).map(([code]) => code);
  if (input.riasecCode) recommendedFocus.push(`Hướng Holland ${input.riasecCode}`);
  const extraFacts = Object.values(input.extras ?? {}).filter(Boolean).slice(0, 3);
  return {
    canonical: {
      strengths: strengths.length ? strengths : extraFacts.slice(0, 2),
      gaps,
      recommendedFocus,
      grades,
    },
    freeText: clampKnowledgeFreeText(input.freeText ?? ''),
  };
}
