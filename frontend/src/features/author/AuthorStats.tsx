import { useApiResource } from "../../lib/useApiResource";
export default function AuthorStats() {
  const resource = useApiResource<Record<string, number>>(
    "/authors/me/analytics",
  );
  if (resource.error)
    return (
      <p role="alert">
        Author statistics are unavailable.{" "}
        <button className="link" onClick={resource.reload}>
          Retry statistics
        </button>
      </p>
    );
  if (!resource.data) return <p role="status">Loading author statistics…</p>;
  return (
    <section
      aria-label="Author statistics"
      className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
    >
      {[
        ["Stories", resource.data.books],
        ["Recorded book views", resource.data.recordedBookViews],
        ["Released visible chapters", resource.data.releasedChapters],
        ["Followers", resource.data.followers],
        ["Eligible memberships", resource.data.eligibleMemberships],
      ].map(([label, value]) => (
        <article className="card bg-base-100 text-base-content p-5" key={label}>
          <h2 className="text-sm">{label}</h2>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </article>
      ))}
    </section>
  );
}
