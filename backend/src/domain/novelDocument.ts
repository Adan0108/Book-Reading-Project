import { BadRequestError } from "../core/error.response";

export interface NovelText {
  type: "text";
  text: string;
  styles: Partial<Record<"bold" | "italic" | "underline" | "strike", boolean>>;
}
export type NovelInline =
  | NovelText
  | { type: "link"; href: string; content: NovelText[] };
export interface NovelBlock {
  id: string;
  type:
    | "paragraph"
    | "heading"
    | "quote"
    | "divider"
    | "authorNote"
    | "illustration";
  props: {
    level?: number;
    assetId?: string;
    caption?: string;
    textAlignment?: "left" | "center" | "right" | "justify";
  };
  content?: NovelInline[];
  children: NovelBlock[];
}
export interface NovelDocument {
  version: 1;
  blocks: NovelBlock[];
}
const fail = (): never => {
  throw new BadRequestError(
    "Invalid chapter document. Use supported blocks and a document up to 512 KiB.",
  );
};
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail();
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const types = [
  "paragraph",
  "heading",
  "quote",
  "divider",
  "authorNote",
  "illustration",
];
export function parseNovelDocument(value: unknown): NovelDocument {
  const root = record(value);
  if (root.version !== 1 || !Array.isArray(root.blocks)) return fail();
  try {
    if (Buffer.byteLength(JSON.stringify(value)) > 512 * 1024) return fail();
  } catch {
    return fail();
  }
  let count = 0;
  const seen = new Set<string>();
  function text(value: unknown): NovelText {
    const item = record(value);
    if (
      item.type !== "text" ||
      typeof item.text !== "string" ||
      item.text.length > 500000
    )
      return fail();
    const styles: NovelText["styles"] = {};
    if (item.styles !== undefined) {
      const raw = record(item.styles);
      for (const name of ["bold", "italic", "underline", "strike"] as const) {
        if (raw[name] !== undefined && typeof raw[name] !== "boolean")
          return fail();
        if (raw[name]) styles[name] = true;
      }
    }
    return { type: "text", text: item.text, styles };
  }
  function inline(value: unknown): NovelInline {
    const item = record(value);
    if (item.type === "text") return text(item);
    if (
      item.type !== "link" ||
      typeof item.href !== "string" ||
      item.href.length > 2048 ||
      !Array.isArray(item.content)
    )
      return fail();
    // Relative in-app links or explicit safe protocols only, never protocol-relative URLs.
    if (
      !(
        /^\/(?!\/)/.test(item.href) || /^(https?:\/\/|mailto:)/i.test(item.href)
      )
    )
      return fail();
    return { type: "link", href: item.href, content: item.content.map(text) };
  }
  function block(value: unknown, depth: number): NovelBlock {
    if (depth > 8 || ++count > 2000) return fail();
    const item = record(value);
    if (
      typeof item.id !== "string" ||
      !/^[\w-]{1,64}$/.test(item.id) ||
      seen.has(item.id) ||
      !types.includes(String(item.type))
    )
      return fail();
    seen.add(item.id);
    const type = item.type as NovelBlock["type"];
    const raw = item.props === undefined ? {} : record(item.props);
    const props: NovelBlock["props"] = {};
    if (type === "heading") {
      if (![1, 2, 3].includes(Number(raw.level))) return fail();
      props.level = Number(raw.level);
    }
    if (raw.textAlignment !== undefined) {
      if (
        !["left", "center", "right", "justify"].includes(
          String(raw.textAlignment),
        )
      )
        return fail();
      props.textAlignment =
        raw.textAlignment as NovelBlock["props"]["textAlignment"];
    }
    if (type === "illustration") {
      if (
        typeof raw.assetId !== "string" ||
        (raw.assetId !== "" && !uuid.test(raw.assetId))
      )
        return fail();
      if (
        raw.caption !== undefined &&
        (typeof raw.caption !== "string" || raw.caption.length > 1000)
      )
        return fail();
      props.assetId = raw.assetId;
      props.caption = String(raw.caption ?? "");
    }
    const children = item.children === undefined ? [] : item.children;
    if (!Array.isArray(children)) return fail();
    const result: NovelBlock = {
      id: item.id,
      type,
      props,
      children: children.map((child) => block(child, depth + 1)),
    };
    if (type !== "illustration" && type !== "divider") {
      if (!Array.isArray(item.content)) return fail();
      result.content = item.content.map(inline);
    }
    return result;
  }
  return { version: 1, blocks: root.blocks.map((value) => block(value, 0)) };
}
export function documentSummary(document: NovelDocument) {
  const assetIds: string[] = [],
    text: string[] = [];
  function visit(block: NovelBlock) {
    if (block.type === "illustration" && block.props.assetId)
      assetIds.push(block.props.assetId);
    text.push(
      (block.content ?? [])
        .map((item) =>
          item.type === "text"
            ? item.text
            : item.content.map((t) => t.text).join(""),
        )
        .join(""),
    );
    block.children.forEach(visit);
  }
  document.blocks.forEach(visit);
  return {
    assetIds,
    wordCount: text.join(" ").trim().split(/\s+/u).filter(Boolean).length,
  };
}
