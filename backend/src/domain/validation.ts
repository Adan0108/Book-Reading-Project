import { BadRequestError } from "../core/error.response";

export function positiveId(value: unknown, label = "ID"): number {
  const number =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1)
    throw new BadRequestError(`Invalid ${label}`);
  return number;
}
export function boundedText(
  value: unknown,
  label: string,
  max: number,
  required = true,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new BadRequestError(
      `${label} ${required ? "is required and " : ""}must be at most ${max} characters`,
    );
  return value.trim();
}
export function integerRange(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new BadRequestError(
      `${label} must be an integer from ${min} to ${max}`,
    );
  return value;
}
export function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean")
    throw new BadRequestError(`${label} must be true or false`);
  return value;
}
