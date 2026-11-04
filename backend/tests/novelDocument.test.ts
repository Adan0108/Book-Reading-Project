import { describe, expect, it } from "vitest";
import {
  parseNovelDocument,
  documentSummary,
} from "../src/domain/novelDocument";
const paragraph = (id = "p") => ({
  id,
  type: "paragraph",
  content: [
    { type: "text", text: "A new story begins.", styles: { bold: true } },
  ],
  children: [],
});
describe("versioned chapter document boundary", () => {
  it("keeps supported formatting and computes authoritative words and illustration order", () => {
    const asset = "a1111111-1111-4111-8111-111111111111";
    const result = parseNovelDocument({
      version: 1,
      blocks: [
        paragraph(),
        {
          id: "pic",
          type: "illustration",
          props: {
            assetId: asset,
            caption: "A bridge",
            url: "blob:never-persist",
          },
          children: [],
        },
      ],
    });
    expect(documentSummary(result)).toEqual({
      wordCount: 4,
      assetIds: [asset],
    });
    expect(JSON.stringify(result)).not.toContain("blob:");
    expect(result.blocks[0].content?.[0]).toMatchObject({
      styles: { bold: true },
    });
  });
  it.each([
    { version: 2, blocks: [] },
    { version: 1, blocks: [paragraph(), paragraph()] },
    { version: 1, blocks: [{ ...paragraph(), type: "codeBlock" }] },
    {
      version: 1,
      blocks: [
        {
          id: "image",
          type: "illustration",
          props: { assetId: "arbitrary-provider-id" },
        },
      ],
    },
    {
      version: 1,
      blocks: [
        {
          ...paragraph(),
          content: [{ type: "link", href: "javascript:alert(1)", content: [] }],
        },
      ],
    },
    {
      version: 1,
      blocks: [
        {
          ...paragraph(),
          content: [{ type: "text", text: "x".repeat(530000) }],
        },
      ],
    },
  ])("rejects unsupported, unsafe or oversized content", (value) =>
    expect(() => parseNovelDocument(value)).toThrow(),
  );
  it("bounds nesting and block count before rendering", () => {
    let child: any = paragraph();
    for (let i = 0; i < 10; i++)
      child = { ...paragraph(`parent${i}`), children: [child] };
    expect(() => parseNovelDocument({ version: 1, blocks: [child] })).toThrow();
    expect(() =>
      parseNovelDocument({
        version: 1,
        blocks: Array.from({ length: 2001 }, (_, i) => paragraph(`p${i}`)),
      }),
    ).toThrow();
  });
});
