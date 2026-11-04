import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
export default function UnsavedWork({
  dirty,
  saving,
}: {
  dirty: boolean;
  saving: boolean;
}) {
  const blocker = useBlocker(dirty || saving),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (blocker.state === "blocked") dialog.current?.showModal();
    else dialog.current?.close();
  }, [blocker.state]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);
  return blocker.state === "blocked" ? (
    <dialog
      ref={dialog}
      aria-label="Unsaved changes"
      onCancel={(e) => {
        e.preventDefault();
        blocker.reset();
      }}
      className="m-auto max-w-lg rounded-xl border p-6 bg-base-100 text-base-content backdrop:bg-black/50"
    >
      <p>
        {saving
          ? "Saving is in progress. Please wait."
          : "Discard unsaved changes and leave? A save with an uncertain response may already have completed."}
      </p>
      <button className="btn mt-4" onClick={() => blocker.reset()}>
        Stay
      </button>
      {!saving && (
        <button className="btn mt-4 ml-2" onClick={() => blocker.proceed()}>
          Discard and leave
        </button>
      )}
    </dialog>
  ) : null;
}
