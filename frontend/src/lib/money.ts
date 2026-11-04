export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
export function decimalCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Enter an amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
