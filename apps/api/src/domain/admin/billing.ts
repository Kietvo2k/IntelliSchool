export type BillingStatus = 'TRIAL' | 'ACTIVE' | 'FREE' | 'SUSPENDED';

export function calculateMonthlyCharge(input: {
  classCount: number;
  includedClassQuota: number;
  basePriceVnd: number;
  extraClassPriceVnd: number;
  status: BillingStatus;
}): { amountVnd: number; extraClassCount: number; isChargeable: boolean } {
  const numericInputs: Record<string, number> = {
    classCount: input.classCount,
    includedClassQuota: input.includedClassQuota,
    basePriceVnd: input.basePriceVnd,
    extraClassPriceVnd: input.extraClassPriceVnd,
  };
  for (const [name, value] of Object.entries(numericInputs)) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  }
  const extraClassCount = Math.max(0, input.classCount - input.includedClassQuota);
  const isChargeable = input.status === 'ACTIVE';
  return { amountVnd: isChargeable ? input.basePriceVnd + extraClassCount * input.extraClassPriceVnd : 0, extraClassCount, isChargeable };
}
