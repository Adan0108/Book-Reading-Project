# Text-first writing studio

Implementation branch: `feat/light-novel-editor`, based on merged authentication `4e602cd`. Merged as `d326c94`, merge `30fef17`; see [current progress](../mvp/IMPLEMENTATION_PROGRESS.md).

## Editing engine decision

BlockNote 0.57 supplies document editing, selection, undo/redo, slash/plus menus, a selection toolbar, block drag handles and keyboard movement. Tiptap was also evaluated: its modular extensions provide greater control but require assembling more of the desired document UI. The chosen BlockNote schema includes paragraphs, three heading levels, quotes, dividers, author notes and illustrations. Tables, code, audio, video, collaboration and AI features are not enabled. Core packages use MPL-2.0; the application consumes them without modifying their source. No paid editor extensions are used.

The editor is loaded dynamically so reading does not download the authoring engine. A single engine instance remains mounted across ordinary edits, reorders and the first autosaved creation. Enter, native clipboard operations, formatting shortcuts and undo are handled by the mature engine. Plain text paste remains literal text; rich paste is normalized to the configured schema.

References: [BlockNote custom blocks](https://www.blocknotejs.org/docs/features/custom-schemas/custom-blocks), [suggestion menus](https://www.blocknotejs.org/docs/react/components/suggestion-menus), [side menu](https://www.blocknotejs.org/docs/react/components/side-menu), [Tiptap architecture](https://tiptap.dev/docs/editor/getting-started/overview). Installed package types, rather than documentation examples for older versions, determine API usage.

## Persistence boundary

`chapter_documents` is additive: one versioned JSON document per chapter. Legacy `content_md` remains unchanged. Existing Markdown chapters keep their compatibility editor and safe reader rendering; they are not silently converted. New chapters use structured content. A legacy caller attempting to overwrite a structured chapter through Markdown receives 409 and must reload the current editor.

The backend owns validation and canonical projection. Version 1 permits only supported block/inline types, safe links, boolean formatting, bounded IDs, eight nesting levels, 2,000 blocks and 512 KiB of JSON. Duplicate block IDs and unsupported versions are rejected. Persisted documents are validated again when read. The JSON request limit is explicitly 1 MiB to accommodate long chapters and metadata. Word counts are computed from concatenated inline text within each block, using whitespace-separated words; they are not client-authoritative for structured content.

Illustrations store an opaque confirmed asset ID and caption, never a blob URL or client-provided delivery URL. Document traversal determines the exact image relationship order. Assets must belong to this author/book and pass the existing confirmation/attachment checks. The chapter, structured document, ordered relationships, publication state and idempotency result commit together. An existing Markdown source remains available in storage even after an explicit API conversion.

## Save and media lifecycle

Draft text and metadata save after five idle seconds, including initial creation after a title is entered. Autosave keeps the editor writable, captures a revision and clears the dirty flag only if that revision is still current. Later edits get another save. Explicit saves/publish disable editing and prevent duplicate submission. Published edits require an explicit action; autosave never silently publishes them.

Selecting files creates local previews. New file selections suspend autosave until explicit save/publish, so an automatic text save never unexpectedly uploads them. Removed image blocks are excluded from upload; replacement retains only the current selection. Blob previews are revoked on removal/replacement/unmount. Removed source File objects remain bounded within the mounted editing session for undo; undo recreates a preview. Up to 100 selections may be retained until reopening, which can consume substantial memory at the 10 MiB per-file limit.

Signed direct upload and confirmation retain successful asset IDs across retry. A stable request ID protects an ambiguous save. If a creation response was lost and the author subsequently edited its content, the client first replays the original request to recover the created ID, then applies the new content as an update. This avoids creating a second draft merely because its first response was lost.

Navigation protection covers unsaved edits and active saves. Text/files are not durably stored offline: closing or crashing the tab can lose changes that have not reached the server. A failed autosave shows an error and stops automatic retries until editing or explicit retry; the editor does not claim those edits were saved.

## Reader

Structured content renders with a small React renderer, not the editing engine or raw HTML. Images are resolved only through the server-returned asset map. Legacy Markdown continues to use the existing safe Markdown renderer. Shared prose styling establishes readable width, paragraph/heading/scene spacing and quote/note presentation.

The reader uses actual released chapter headers for previous/next navigation, rather than guessing numeric adjacency. Font size and light/dark preferences stay locally in the browser. Approximate scroll progress is retained for at most fifty chapters; no chapter body is stored. Progress can shift while late-loading images change page height. Paid access remains server-enforced; the shared membership service now enforces the parent and child rules; see [membership design](MEMBERSHIPS.md).

## Migration and rollback

Apply `20261104_0004_chapter_documents.sql` after backup/review. Only the isolated QA schema has been migrated. There is no destructive conversion or schema rollback. Older application code cannot render new structured chapters fully, so rollback must preserve the new reader/compatibility support or prevent publication of structured content. Keeping the legacy column does not reconstruct new structured text as Markdown.


The distributed frontend includes editor source attribution at /third-party-notices.txt and a verbatim MPL-2.0 copy under /licenses/. Upstream source is pinned to the installed package’s published gitHead; the library source is not modified.
