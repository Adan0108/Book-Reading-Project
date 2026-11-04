import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { publicationService } from "./publicationService";
import { useThemeStore } from "../../store/useThemeStore";
import { ImageEditor } from "./ImageEditor";
import {
  localImage,
  message,
  releaseImage,
  uploadImages,
  validateImage,
  MAX_PAGES,
  type EditorImage,
} from "./images";
import {
  documentText,
  emptyDocument,
  flattenBlocks,
  resolveAssets,
  type NovelDocument,
} from "../studio/document";
import { useDraftAutosave } from "../studio/useDraftAutosave";
import { isAxiosError } from "axios";
import type { AuthorTier } from "../membership/types";
const NovelStudio = lazy(() => import("../studio/NovelStudio"));

interface Form {
  title: string;
  genre: string;
  synopsis: string;
  contentMd: string;
  visibility: string;
  status: string;
  tags: string;
}
const empty: Form = {
  title: "",
  genre: "",
  synopsis: "",
  contentMd: "",
  visibility: "PUBLIC",
  status: "DRAFT",
  tags: "",
};
interface PageImage {
  id: string;
  imageUrl: string;
}
export default function PublicationEditor({
  kind,
  edit = false,
}: {
  kind: "book" | "chapter";
  edit?: boolean;
}) {
  const params = useParams();
  const bookId = params.bookId ? Number(params.bookId) : undefined;
  const chapterId = params.chapterId ? Number(params.chapterId) : undefined;
  const navigate = useNavigate();
  const { isDark } = useThemeStore();
  const [form, setForm] = useState<Form>(empty);
  const [images, setImages] = useState<EditorImage[]>([]);
  const media = useRef<EditorImage[]>([]);
  const [document, setDocument] = useState<NovelDocument | null>(() =>
    kind === "chapter" && !edit ? emptyDocument() : null,
  );
  const [bookTitle, setBookTitle] = useState("");
  const [bookVisibility, setBookVisibility] = useState("PUBLIC");
  const [moderationMessage, setModerationMessage] = useState("");
  const [tierOptions, setTierOptions] = useState<AuthorTier[]>([]);
  const [tierError, setTierError] = useState("");
  const [requiredTierIds, setRequiredTierIds] = useState<number[]>([]);
  const tierChanged = useRef(false);
  const [loading, setLoading] = useState(edit || kind === "chapter");
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const revision = useRef(0);
  const createdChapter = useRef<number | null>(null);
  const recoveredEndpoint = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [progress, setProgress] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const lock = useRef(false);
  const allowNavigation = useRef(false);
  const blocker = useBlocker(
    () => !allowNavigation.current && (dirty || lock.current),
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (blocker.state === "blocked") dialog.current?.showModal();
    else dialog.current?.close();
  }, [blocker.state]);
  const request = useRef<{ id: string; payload: string } | null>(null);
  const endpoint =
    kind === "book"
      ? `/authors/me/books${edit ? `/${bookId}` : ""}`
      : `/authors/me/books/${bookId}/chapters${edit ? `/${chapterId}` : ""}`;
  useEffect(() => {
    media.current = images;
  }, [images]);
  useEffect(() => () => media.current.forEach(releaseImage), []);
  useEffect(() => {
    let active = true;
    publicationService
      .getTiers()
      .then((tiers) => {
        if (active) setTierOptions(tiers);
      })
      .catch((e: unknown) => {
        if (active) setTierError(message(e));
      });
    return () => {
      active = false;
    };
  }, []);
  useDraftAutosave(
    () => save("DRAFT", true),
    kind === "chapter" &&
      form.status === "DRAFT" &&
      Boolean(form.title.trim()) &&
      dirty &&
      !saving &&
      !loading &&
      !error &&
      !images.some((i) => i.file && !i.assetId),
    JSON.stringify({ form, document }),
  );
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (edit && kind === "chapter" && createdChapter.current === chapterId) {
        createdChapter.current = null;
        recoveredEndpoint.current = null;
        allowNavigation.current = false;
        return;
      }
      if (!edit && kind === "book") return;
      media.current.forEach(releaseImage);
      media.current = [];
      setImages([]);
      setForm(empty);
      setRequiredTierIds([]);
      tierChanged.current = false;
      setDocument(kind === "chapter" && !edit ? emptyDocument() : null);
      setDirty(false);
      setProgress("");
      allowNavigation.current = false;
      request.current = null;
      recoveredEndpoint.current = null;
      setLoading(true);
      setError("");
      setLoadFailed(false);
      try {
        const b = await publicationService.getBook(bookId!);
        const data =
          kind === "chapter" && edit
            ? await publicationService.getChapter(endpoint)
            : b;
        if (cancelled) return;
        setBookTitle(b.title);
        setBookVisibility(b.visibility ?? "PUBLIC");
        const hidden = [b, data].find((item) => item.moderationHidden);
        setModerationMessage(
          hidden
            ? `This content is hidden by moderation. Saving does not restore public access. ${hidden.moderationReason ?? ""}`
            : "",
        );
        if (edit) {
          setRequiredTierIds(data.requiredTierIds ?? []);
          setForm({
            title: data.title,
            genre: data.genre ?? "",
            synopsis: data.synopsis ?? "",
            contentMd: data.contentMarkdown ?? "",
            visibility: data.visibility,
            status:
              kind === "chapter"
                ? data.isDraft
                  ? "DRAFT"
                  : "PUBLISHED"
                : data.status,
            tags: (data.tags ?? [])
              .map((t: { name: string }) => t.name)
              .join(", "),
          });
          const loadedDocument: NovelDocument | null =
            data.contentDocument ?? null;
          setDocument(loadedDocument);
          const remote: PageImage[] = data.images ?? [];
          setImages(
            kind === "book"
              ? data.coverUrl
                ? [
                    {
                      id: "existing-cover",
                      previewUrl: data.coverUrl,
                      status: "uploaded",
                    },
                  ]
                : []
              : loadedDocument
                ? flattenBlocks(loadedDocument)
                    .filter((b) => b.type === "illustration" && b.props.assetId)
                    .map((b) => ({
                      id: b.id,
                      assetId: b.props.assetId,
                      previewUrl:
                        remote.find((i) => i.id === b.props.assetId)
                          ?.imageUrl ?? "",
                      status: "uploaded",
                    }))
                : remote.map((i: PageImage) => ({
                    id: i.id,
                    assetId: i.id,
                    previewUrl: i.imageUrl,
                    status: "uploaded",
                  })),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(message(e));
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bookId, chapterId, edit, kind, endpoint, loadVersion]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || saving) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);
  function field(key: keyof Form, value: string) {
    revision.current++;
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setError("");
  }
  function chooseIllustration(id: string, file: File) {
    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return false;
    }
    const old = media.current.find((i) => i.id === id);
    if (!old && media.current.length >= MAX_PAGES) {
      setError(
        "Use at most 100 illustrations per editing session. Save and reopen to clear removed selections.",
      );
      return false;
    }
    if (old) releaseImage(old);
    const selected = { ...localImage(file), id };
    revision.current++;
    const next = [...media.current.filter((i) => i.id !== id), selected];
    media.current = next;
    setImages(next);
    setDirty(true);
    setError("");
    return true;
  }
  function changeDocument(next: NovelDocument) {
    revision.current++;
    setDocument(next);
    setDirty(true);
    setError("");
    const active = new Set(flattenBlocks(next).map((b) => b.id));
    let changed = false;
    const updated = media.current.map((image) => {
      if (!active.has(image.id) && image.previewUrl.startsWith("blob:")) {
        releaseImage(image);
        changed = true;
        return { ...image, previewUrl: "" };
      }
      if (active.has(image.id) && image.file && !image.previewUrl) {
        changed = true;
        return { ...image, previewUrl: URL.createObjectURL(image.file) };
      }
      return image;
    });
    if (changed) {
      media.current = updated;
      setImages(updated);
    }
  }
  async function save(status: string, automatic = false) {
    if (lock.current) return;
    if (form.visibility === "TIERS" && !requiredTierIds.length) {
      setError(
        "Choose a required membership tier. Configure your plans under Memberships first.",
      );
      return;
    }
    if (!form.title.trim() || (kind === "book" && !form.genre.trim())) {
      setError("Enter a title" + (kind === "book" ? " and genre." : "."));
      return;
    }
    const orderedImages = document
      ? flattenBlocks(document)
          .filter((b) => b.type === "illustration")
          .flatMap((b) => images.filter((i) => i.id === b.id))
      : images;
    if (
      kind === "chapter" &&
      status === "PUBLISHED" &&
      !orderedImages.length &&
      !(document ? documentText(document).trim() : form.contentMd.trim())
    ) {
      setError("Add an illustration or chapter text before publishing.");
      return;
    }
    const snapshot = revision.current;
    let persisting = false;
    lock.current = true;
    setSaving(true);
    setBusy(!automatic);
    setError("");
    setProgress("Preparing images…");
    try {
      const uploadable = orderedImages.filter((i) => i.file || i.assetId);
      const ids = await uploadImages(
        uploadable,
        kind === "book" ? "cover" : "chapter",
        bookId,
        (image) =>
          setImages((current) =>
            current.map((i) => (i.id === image.id ? image : i)),
          ),
        (done, total) =>
          setProgress(
            `Uploading images: ${done} / ${total} (${total ? Math.round((done / total) * 100) : 100}%)`,
          ),
      );
      const tierPatch = !edit || tierChanged.current ? { requiredTierIds } : {};
      const data =
        kind === "book"
          ? {
              title: form.title.trim(),
              genre: form.genre.trim(),
              synopsis: form.synopsis,
              visibility: form.visibility,
              ...tierPatch,
              status,
              tags: form.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              ...(ids[0] ? { coverAssetId: ids[0] } : {}),
              removeCover: !images.length,
            }
          : {
              title: form.title.trim(),
              ...(document
                ? {
                    contentDocument: resolveAssets(
                      document,
                      new Map(
                        uploadable.map((image, index) => [
                          image.id,
                          ids[index],
                        ]),
                      ),
                    ),
                  }
                : { contentMd: form.contentMd }),
              visibility: form.visibility,
              ...tierPatch,
              isDraft: status === "DRAFT",
              imageAssetIds: ids,
            };
      const payload = JSON.stringify(data);
      persisting = true;
      // A lost creation response must be resolved before edited content starts a new request.
      // Replaying the original body obtains the committed ID instead of creating another draft.
      if (
        !edit &&
        !recoveredEndpoint.current &&
        request.current &&
        request.current.payload !== payload
      ) {
        const original = await publicationService.save(endpoint, false, {
          ...JSON.parse(request.current.payload),
          requestId: request.current.id,
        });
        recoveredEndpoint.current =
          kind === "book"
            ? `/authors/me/books/${original.id}`
            : `/authors/me/books/${bookId}/chapters/${original.chapterId}`;
      }
      if (!request.current || request.current.payload !== payload)
        request.current = { id: crypto.randomUUID(), payload };
      setProgress(status === "PUBLISHED" ? "Publishing…" : "Saving draft…");
      const result = await publicationService.save(
        recoveredEndpoint.current ?? endpoint,
        edit || Boolean(recoveredEndpoint.current),
        { ...data, requestId: request.current.id },
      );
      if (revision.current === snapshot) {
        setDirty(false);
        tierChanged.current = false;
      }
      setForm((f) => ({ ...f, status }));
      setProgress(
        status === "PUBLISHED"
          ? "Published successfully."
          : "Draft saved successfully.",
      );
      request.current = null;
      if (!edit) {
        if (kind === "chapter") createdChapter.current = result.chapterId;
        allowNavigation.current = true;
        navigate(
          kind === "book"
            ? `/author/comic/${result.id}/edit`
            : `/author/comic/${bookId}/chapter/${result.chapterId}/edit`,
          { replace: true },
        );
      }
    } catch (e) {
      if (
        persisting &&
        isAxiosError(e) &&
        e.response &&
        e.response.status < 500
      )
        request.current = null;
      setError(message(e));
      setProgress(
        "Save did not complete. Your work is preserved; retry when ready.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
      setSaving(false);
    }
  }
  const input = "input input-bordered w-full";
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`min-h-screen pt-24 pb-16 px-4 ${isDark ? "bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-900"}`}
    >
      <div className="max-w-4xl mx-auto">
        <Link to="/author/dashboard" className="link">
          ← My books
        </Link>
        <h1 className="text-3xl font-bold my-4">
          {edit ? "Edit" : "Create"} {kind}
          {kind === "chapter" && bookTitle ? ` · ${bookTitle}` : ""}
        </h1>
        <p>
          {dirty ? "Unsaved changes" : "Ready"} ·{" "}
          {form.status === "PUBLISHED"
            ? "Published"
            : form.status === "HIDDEN"
              ? "Hidden"
              : "Draft"}
        </p>
        {error && (
          <div role="alert" className="alert alert-error my-4">
            {error}
          </div>
        )}
        {moderationMessage && (
          <p role="note" className="alert alert-warning my-4">
            {moderationMessage}
          </p>
        )}
        {loading ? (
          <p role="status">Loading…</p>
        ) : loadFailed ? (
          <button className="btn" onClick={() => setLoadVersion((v) => v + 1)}>
            Retry loading
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save("DRAFT");
            }}
            className="my-4"
          >
            <fieldset disabled={busy} className="space-y-4">
              <label className="block">
                Title
                <input
                  aria-label="Title"
                  className={input}
                  value={form.title}
                  maxLength={255}
                  required
                  onChange={(e) => field("title", e.target.value)}
                />
              </label>
              {kind === "book" && (
                <>
                  <label className="block">
                    Genre
                    <input
                      aria-label="Genre"
                      className={input}
                      value={form.genre}
                      required
                      maxLength={255}
                      onChange={(e) => field("genre", e.target.value)}
                    />
                  </label>
                  <label className="block">
                    Synopsis
                    <textarea
                      aria-label="Synopsis"
                      className="textarea textarea-bordered w-full"
                      rows={4}
                      value={form.synopsis}
                      onChange={(e) => field("synopsis", e.target.value)}
                    />
                  </label>
                  <label className="block">
                    Tags (separate with commas)
                    <input
                      aria-label="Tags"
                      className={input}
                      value={form.tags}
                      onChange={(e) => field("tags", e.target.value)}
                    />
                  </label>
                </>
              )}
              <label className="block">
                Visibility
                <select
                  aria-label="Visibility"
                  className="select select-bordered w-full"
                  value={form.visibility}
                  onChange={(e) => field("visibility", e.target.value)}
                >
                  <option value="PUBLIC">Public</option>
                  <option value="MEMBERS">Members</option>
                  <option value="TIERS">Membership tiers</option>
                </select>
              </label>
              {kind === "chapter" && bookVisibility !== "PUBLIC" && (
                <p className="text-sm">
                  This book requires{" "}
                  {bookVisibility === "TIERS"
                    ? "a qualifying membership tier"
                    : "an active membership"}
                  . Chapter settings can further restrict access.
                </p>
              )}
              {form.visibility === "TIERS" && (
                <label className="block">
                  Minimum membership tier
                  <select
                    aria-label="Minimum membership tier"
                    className="select select-bordered w-full"
                    value={
                      requiredTierIds.length > 1
                        ? "custom"
                        : (requiredTierIds[0] ?? "")
                    }
                    required
                    onChange={(event) => {
                      setRequiredTierIds(
                        event.target.value ? [Number(event.target.value)] : [],
                      );
                      tierChanged.current = true;
                      revision.current++;
                      setDirty(true);
                      setError("");
                    }}
                  >
                    <option value="">Choose a tier</option>
                    {requiredTierIds.length > 1 && (
                      <option value="custom" disabled>
                        Existing selection ({requiredTierIds.length} tiers)
                      </option>
                    )}
                    {tierOptions.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                        {tier.level ? ` · Tier ${tier.level}` : ""}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm">
                    Tier 2 includes tier 1 content.{" "}
                    <Link to="/author/memberships" className="link">
                      Manage plans
                    </Link>
                  </span>
                  {tierError && <span role="alert">{tierError}</span>}
                </label>
              )}
              {(kind === "book" || !document) && (
                <ImageEditor
                  images={images}
                  disabled={busy}
                  cover={kind === "book"}
                  onChange={(value) => {
                    revision.current++;
                    media.current = value;
                    setImages(value);
                    setDirty(true);
                    setError("");
                  }}
                />
              )}
              {kind === "chapter" && document && (
                <Suspense
                  fallback={<p role="status">Opening writing studio…</p>}
                >
                  <NovelStudio
                    initialDocument={document}
                    onChange={changeDocument}
                    images={images}
                    onChooseImage={chooseIllustration}
                    onError={setError}
                    disabled={busy}
                    dark={isDark}
                  />
                </Suspense>
              )}
              {kind === "chapter" && !document && (
                <details open={!!form.contentMd}>
                  <summary>Legacy chapter text (original format)</summary>
                  <textarea
                    aria-label="Chapter text"
                    rows={12}
                    className="textarea textarea-bordered w-full"
                    value={form.contentMd}
                    onChange={(e) => field("contentMd", e.target.value)}
                  />
                </details>
              )}
              {kind === "chapter" && (
                <p className="text-sm opacity-70">
                  {form.status === "DRAFT"
                    ? "Text autosaves after five seconds of inactivity. Save to upload new illustrations."
                    : "Published changes require an explicit save or publish action."}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button type="submit" className="btn" disabled={saving}>
                  Save Draft
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  disabled={saving}
                  onClick={() => void save("PUBLISHED")}
                >
                  {kind === "chapter" ? "Publish Chapter" : "Publish Book"}
                </button>
                {kind === "book" && edit && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void save("HIDDEN")}
                  >
                    Hide Book
                  </button>
                )}
              </div>
            </fieldset>
          </form>
        )}
        <p
          role="status"
          aria-label="Save progress"
          aria-live="polite"
          className="my-4"
        >
          {progress}
        </p>
        {blocker.state === "blocked" && (
          <dialog
            ref={dialog}
            aria-label="Unsaved changes"
            className="m-auto max-w-lg border rounded-xl p-6 bg-base-100 text-base-content backdrop:bg-black/50"
            onCancel={(event) => {
              event.preventDefault();
              blocker.reset();
            }}
          >
            <p>
              {saving
                ? "Saving is in progress. Please wait before leaving."
                : "Leave and discard unsaved changes?"}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => blocker.reset()}
            >
              Stay
            </button>
            {!saving && (
              <button
                type="button"
                className="btn"
                onClick={() => blocker.proceed()}
              >
                Discard and leave
              </button>
            )}
          </dialog>
        )}
        {kind === "book" && edit && (
          <Link className="btn" to={`/author/comic/${bookId}/chapter/create`}>
            Create Chapter
          </Link>
        )}
      </div>
    </main>
  );
}
