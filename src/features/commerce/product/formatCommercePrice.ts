const MIN_COMMERCE_AMOUNT_MINOR = 1;
const MAX_COMMERCE_AMOUNT_MINOR = 9_999_999_999;

/** Format validated CNY minor units without a floating-point major-unit conversion. */
export function formatCommercePrice(amountMinor: number): string {
  if (
    !Number.isInteger(amountMinor) ||
    amountMinor < MIN_COMMERCE_AMOUNT_MINOR ||
    amountMinor > MAX_COMMERCE_AMOUNT_MINOR
  ) {
    throw new RangeError("Commerce price must be an accepted integer minor-unit amount");
  }

  const digits = String(amountMinor).padStart(3, "0");
  return `¥${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
