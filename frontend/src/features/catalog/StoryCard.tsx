import { Link } from "react-router-dom";
import type { StorySummary } from "./types";
export default function StoryCard({ story }: { story: StorySummary }) {
  return (
    <article className="card bg-base-100 overflow-hidden shadow-sm">
      <Link
        className="block focus-visible:outline-2 focus-visible:outline-primary"
        to={`/comic/${story.slug}`}
        aria-label={`Read ${story.title}`}
      >
        <div className="aspect-[3/2] bg-base-300 flex items-center justify-center overflow-hidden">
          {story.coverUrl ? (
            <img
              src={story.coverUrl}
              alt={`Cover of ${story.title}`}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="text-3xl font-serif p-6 text-center opacity-60"
              aria-hidden="true"
            >
              {story.title.slice(0, 80)}
            </span>
          )}
        </div>
      </Link>
      <div className="p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {story.genre}
        </p>
        <h2 className="text-xl font-bold">
          <Link to={`/comic/${story.slug}`}>{story.title}</Link>
        </h2>
        <Link className="link text-sm" to={`/author/${story.authorId}`}>
          {story.authorName || "Author"}
        </Link>
        <p className="text-sm leading-6 line-clamp-3">
          {story.synopsis || "A new story is waiting to be discovered."}
        </p>
        <p className="text-xs opacity-75">
          {story.totalChapters} released chapters · {story.viewsCount ?? 0}{" "}
          recorded views
        </p>
        {(story.visibility !== "PUBLIC" || story.hasMembersOnlyChapters) && (
          <p className="text-xs">Includes member content</p>
        )}
      </div>
    </article>
  );
}
