import { createContext, useContext, type ChangeEvent } from "react";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultStyleSpecs,
  createHeadingBlockSpec,
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
  type BlockNoteEditor,
} from "@blocknote/core";
import {
  createReactBlockSpec,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenu } from "@blocknote/core/extensions";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./studio.css";
import { validateImage, MAX_PAGES, type EditorImage } from "../author/images";
import type { NovelBlock, NovelDocument, NovelInline } from "./document";

const MediaContext = createContext<{
  images: EditorImage[];
  choose: (id: string, file: File) => boolean;
}>({ images: [], choose: () => false });
const authorNote = createReactBlockSpec(
  { type: "authorNote", propSchema: {}, content: "inline" },
  {
    render: ({ contentRef }) => (
      <aside className="studio-author-note">
        <span contentEditable={false}>Author’s note</span>
        <div ref={contentRef} />
      </aside>
    ),
  },
)();
const illustration = createReactBlockSpec(
  {
    type: "illustration",
    propSchema: { assetId: { default: "" }, caption: { default: "" } },
    content: "none",
  },
  {
    meta: { draggable: true, selectable: true },
    render: function Illustration({ block, editor }) {
      const media = useContext(MediaContext),
        image = media.images.find((i) => i.id === block.id);
      function choose(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (media.choose(block.id, file))
          editor.updateBlock(block, { props: { assetId: "" } });
        event.target.value = "";
      }
      return (
        <figure className="studio-illustration" contentEditable={false}>
          {image?.previewUrl && (
            <img
              src={image.previewUrl}
              alt={block.props.caption || "Chapter illustration"}
              decoding="async"
            />
          )}
          <label className="btn btn-sm">
            {image ? "Replace illustration" : "Choose illustration"}
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={choose}
            />
          </label>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => editor.removeBlocks([block])}
          >
            Remove illustration
          </button>
          <label className="block mt-2">
            Illustration caption
            <input
              className="input input-bordered w-full"
              value={block.props.caption}
              maxLength={1000}
              onChange={(event) =>
                editor.updateBlock(block, {
                  props: { caption: event.target.value },
                })
              }
            />
          </label>
          {image?.error && <p role="alert">{image.error}</p>}
        </figure>
      );
    },
    toExternalHTML: () => <p>[Illustration]</p>, // Never export local preview URLs through rich clipboard HTML.
  },
)();
const studioSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: createHeadingBlockSpec({
      levels: [1, 2, 3],
      allowToggleHeadings: false,
    }),
    quote: defaultBlockSpecs.quote,
    divider: defaultBlockSpecs.divider,
    authorNote,
    illustration,
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
    strike: defaultStyleSpecs.strike,
  },
});
type StudioBlock = typeof studioSchema.Block;
type StudioPartial = typeof studioSchema.PartialBlock;
type StudioEditor = BlockNoteEditor<
  typeof studioSchema.blockSchema,
  typeof studioSchema.inlineContentSchema,
  typeof studioSchema.styleSchema
>;
function initialBlock(block: NovelBlock): StudioPartial {
  return {
    ...block,
    content: block.content,
    children: block.children.map(initialBlock),
  } as StudioPartial; // Validated version-1 document is a strict subset of this editor schema.
}
function serialize(blocks: StudioBlock[]): NovelBlock[] {
  return blocks.map((block) => {
    const props: NovelBlock["props"] = {};
    if (block.type === "heading") props.level = block.props.level;
    if ("textAlignment" in block.props)
      props.textAlignment = block.props.textAlignment;
    if (block.type === "illustration") {
      props.assetId = block.props.assetId;
      props.caption = block.props.caption;
    }
    const content = block.content?.map(
      (item): NovelInline =>
        item.type === "text"
          ? { type: "text", text: item.text, styles: item.styles }
          : {
              type: "link",
              href: item.href,
              content: item.content.map((t) => ({
                type: "text",
                text: t.text,
                styles: t.styles,
              })),
            },
    );
    return {
      id: block.id,
      type: block.type,
      props,
      ...(content ? { content } : {}),
      children: serialize(block.children),
    };
  });
}
function menuItems(editor: StudioEditor) {
  return [
    ...getDefaultReactSlashMenuItems(editor),
    {
      title: "Author note",
      aliases: ["note"],
      group: "Story",
      onItemClick: () =>
        insertOrUpdateBlockForSlashMenu(editor, { type: "authorNote" }),
    },
    {
      title: "Illustration",
      aliases: ["image", "picture"],
      group: "Story",
      onItemClick: () =>
        insertOrUpdateBlockForSlashMenu(editor, { type: "illustration" }),
    },
  ];
}
export default function NovelStudio({
  initialDocument,
  onChange,
  images,
  onChooseImage,
  onError,
  disabled,
  dark,
}: {
  initialDocument: NovelDocument;
  onChange: (document: NovelDocument) => void;
  images: EditorImage[];
  onChooseImage: (id: string, file: File) => boolean;
  onError: (error: string) => void;
  disabled: boolean;
  dark: boolean;
}) {
  const editor = useCreateBlockNote({
    schema: studioSchema,
    initialContent: initialDocument.blocks.map(initialBlock),
    tabBehavior: "prefer-navigate-ui",
    domAttributes: {
      editor: {
        "aria-label": "Chapter text",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    pasteHandler: ({ defaultPasteHandler }) =>
      defaultPasteHandler({
        prioritizeMarkdownOverHTML: false,
        plainTextAsMarkdown: false,
      }),
  });
  return (
    <MediaContext.Provider value={{ images, choose: onChooseImage }}>
      <section
        className="novel-studio"
        data-studio-theme={dark ? "dark" : "light"}
        aria-label="Chapter writing studio"
        onDragOverCapture={(event) => {
          if (Array.from(event.dataTransfer.types).includes("Files"))
            event.preventDefault();
        }}
        onDropCapture={(event) => {
          if (event.defaultPrevented) return;
          const files = Array.from(event.dataTransfer.files);
          if (!files.length) return;
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          if (disabled) return;
          const invalid = files.map(validateImage).filter(Boolean);
          if (invalid.length) {
            onError(invalid.join(" "));
            return;
          }
          if (images.length + files.length > MAX_PAGES) {
            onError("Use at most 100 illustrations per editing session.");
            return;
          }
          let anchor = editor.getTextCursorPosition().block.id;
          for (const file of files) {
            const id = crypto.randomUUID();
            if (!onChooseImage(id, file)) break;
            anchor = editor.insertBlocks(
              [{ id, type: "illustration" }],
              anchor,
              "after",
            )[0].id;
          }
        }}
        onKeyDownCapture={(event) => {
          if (
            !disabled &&
            event.altKey &&
            event.shiftKey &&
            ["ArrowUp", "ArrowDown"].includes(event.key)
          ) {
            event.preventDefault();
            if (event.key === "ArrowUp") editor.moveBlocksUp();
            else editor.moveBlocksDown();
          }
        }}
      >
        <div className="studio-tools" role="toolbar" aria-label="Writing tools">
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.undo()}
          >
            Undo
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.redo()}
          >
            Redo
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.toggleStyles({ bold: true })}
          >
            Bold
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.toggleStyles({ italic: true })}
          >
            Italic
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            onClick={() => {
              const current = editor.getTextCursorPosition().block;
              const inserted = editor.insertBlocks(
                [{ type: "paragraph" }],
                current,
                "after",
              )[0];
              editor.setTextCursorPosition(inserted);
              editor.focus();
              editor.getExtension(SuggestionMenu)?.openSuggestionMenu("/");
            }}
          >
            Add block
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.moveBlocksUp()}
          >
            Move selected block up
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.moveBlocksDown()}
          >
            Move selected block down
          </button>
        </div>
        <p className="studio-hint">
          Start writing. Type / to add a heading, scene break, note or optional
          illustration. Move blocks with Alt+Shift+↑/↓.
        </p>
        <BlockNoteView
          editor={editor}
          theme={dark ? "dark" : "light"}
          editable={!disabled}
          slashMenu={false}
          onChange={() =>
            onChange({ version: 1, blocks: serialize(editor.document) })
          }
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(menuItems(editor), query)
            }
          />
        </BlockNoteView>
      </section>
    </MediaContext.Provider>
  );
}
