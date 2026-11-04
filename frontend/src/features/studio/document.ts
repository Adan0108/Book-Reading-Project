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
export const emptyDocument = (): NovelDocument => ({
  version: 1,
  blocks: [
    {
      id: crypto.randomUUID(),
      type: "paragraph",
      props: {},
      content: [],
      children: [],
    },
  ],
});
export function flattenBlocks(document: NovelDocument): NovelBlock[] {
  return document.blocks.flatMap(function flatten(block): NovelBlock[] {
    return [block, ...block.children.flatMap(flatten)];
  });
}
export function documentText(document: NovelDocument) {
  return flattenBlocks(document)
    .map((b) =>
      (b.content ?? [])
        .map((i) =>
          i.type === "text" ? i.text : i.content.map((t) => t.text).join(""),
        )
        .join(""),
    )
    .join(" ");
}
export function resolveAssets(
  document: NovelDocument,
  assets: Map<string, string>,
): NovelDocument {
  function block(value: NovelBlock): NovelBlock {
    return {
      ...value,
      props:
        value.type === "illustration"
          ? {
              assetId: assets.get(value.id) ?? value.props.assetId ?? "",
              caption: value.props.caption ?? "",
            }
          : value.props,
      children: value.children.map(block),
    };
  }
  return { version: 1, blocks: document.blocks.map(block) };
}
