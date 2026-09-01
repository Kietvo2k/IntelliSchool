/**
 * Ước tính chi phí AI và kiểm tra hạn mức theo trường. Thuần, không phụ thuộc pg.
 * Giá tính theo VND cho mỗi 1.000 token (in/out) để dễ cấu hình cho model nội địa.
 */
export interface TokenPricingVndPer1k {
  inputVndPer1k: number;
  outputVndPer1k: number;
}

export function estimateCostVnd(inputTokens: number, outputTokens: number, pricing: TokenPricingVndPer1k): number {
  const input = Math.max(0, Math.floor(inputTokens));
  const output = Math.max(0, Math.floor(outputTokens));
  const cost = (input / 1000) * pricing.inputVndPer1k + (output / 1000) * pricing.outputVndPer1k;
  return Math.round(cost);
}

export interface BudgetCheck {
  allowed: boolean;
  usedVnd: number;
  limitVnd: number | null;
  remainingVnd: number | null;
}

/** limitVnd null = không giới hạn. Chặn khi chi phí đã dùng + ước tính request vượt hạn mức. */
export function checkBudget(input: { usedVnd: number; estimatedRequestVnd: number; limitVnd: number | null }): BudgetCheck {
  if (input.limitVnd === null || input.limitVnd <= 0) {
    return { allowed: true, usedVnd: input.usedVnd, limitVnd: input.limitVnd, remainingVnd: null };
  }
  const projected = input.usedVnd + Math.max(0, input.estimatedRequestVnd);
  return { allowed: projected <= input.limitVnd, usedVnd: input.usedVnd, limitVnd: input.limitVnd, remainingVnd: Math.max(0, input.limitVnd - input.usedVnd) };
}

/** Ước lượng token thô khi provider không trả usage (xấp xỉ 4 ký tự/token). */
export function approximateTokens(text: string): number {
  return Math.ceil((text ?? '').length / 4);
}
