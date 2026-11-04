import { BadRequestError } from "../core/error.response";
import { boundedText, positiveId } from "./validation";
export function pageQuery(query: Record<string, unknown>) {
  function number(
    value: unknown,
    fallback: number,
    max: number,
    label: string,
  ) {
    if (value === undefined) return fallback;
    const n = positiveId(value, label);
    if (n > max) throw new BadRequestError(`${label} exceeds ${max}`);
    return n;
  }
  return {
    page: number(query.page, 1, 100000, "Page"),
    limit: number(query.limit, 20, 50, "Page size"),
    query: boundedText(query.query ?? "", "Search", 100, false),
  };
}
export function encodeTimeCursor(at: string, id: number) {
  return Buffer.from(JSON.stringify({ at, id })).toString("base64url");
}
export function decodeTimeCursor(
  value: unknown,
): { at: string; id: number } | null {
  if (value === undefined) return null;
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  )
    throw new BadRequestError("Invalid history cursor");
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString(),
    );
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("at" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.at !== "string" ||
      !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/.test(parsed.at)
    )
      throw new Error();
    const calendar = new Date(parsed.at.slice(0, 23).replace(" ", "T") + "Z");
    if (
      Number(parsed.at.slice(0, 4)) < 1000 ||
      !Number.isFinite(calendar.getTime()) ||
      calendar.toISOString().slice(0, 19) !==
        parsed.at.slice(0, 19).replace(" ", "T")
    )
      throw new Error();
    return { at: parsed.at, id: positiveId(parsed.id) };
  } catch {
    throw new BadRequestError("Invalid history cursor");
  }
}
