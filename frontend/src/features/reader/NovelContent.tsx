import { Fragment, type ReactNode } from "react";
import type {
  NovelBlock,
  NovelDocument,
  NovelInline,
} from "../studio/document";

function inline(content: NovelInline[] = []): ReactNode[] {
  return content.map((item, index) => {
    if (item.type === "link")
      return (
        <a
          key={index}
          href={
            /^(https?:\/\/|mailto:|\/(?!\/))/i.test(item.href)
              ? item.href
              : undefined
          }
          rel="noopener noreferrer"
        >
          {inline(item.content)}
        </a>
      );
    let node: ReactNode = item.text;
    if (item.styles.bold) node = <strong>{node}</strong>;
    if (item.styles.italic) node = <em>{node}</em>;
    if (item.styles.underline) node = <u>{node}</u>;
    if (item.styles.strike) node = <s>{node}</s>;
    return <Fragment key={index}>{node}</Fragment>;
  });
}
export default function NovelContent({
  document,
  images,
}: {
  document: NovelDocument;
  images: { id: string; imageUrl: string }[];
}) {
  const urls = new Map(images.map((i) => [i.id, i.imageUrl]));
  function block(item: NovelBlock): ReactNode {
    const content = inline(item.content);
    let node: ReactNode;
    switch (item.type) {
      case "paragraph":
        node = <p>{content.length ? content : <br />}</p>;
        break;
      case "heading":
        node =
          item.props.level === 1 ? (
            <h2>{content}</h2>
          ) : item.props.level === 2 ? (
            <h3>{content}</h3>
          ) : (
            <h4>{content}</h4>
          );
        break;
      case "quote":
        node = <blockquote>{content}</blockquote>;
        break;
      case "divider":
        node = <hr aria-label="Scene break" />;
        break;
      case "authorNote":
        node = (
          <aside className="reader-author-note">
            <p className="reader-note-label">Author’s note</p>
            <p>{content}</p>
          </aside>
        );
        break;
      case "illustration":
        node = urls.get(item.props.assetId ?? "") ? (
          <figure>
            <img
              src={urls.get(item.props.assetId ?? "")}
              alt={item.props.caption || "Chapter illustration"}
              loading="lazy"
              decoding="async"
            />
            {item.props.caption && (
              <figcaption>{item.props.caption}</figcaption>
            )}
          </figure>
        ) : null;
        break;
    }
    return (
      <Fragment key={item.id}>
        <div style={{ textAlign: item.props.textAlignment }}>{node}</div>
        {item.children.length > 0 && (
          <div className="reader-nested">{item.children.map(block)}</div>
        )}
      </Fragment>
    );
  }
  return <>{document.blocks.map(block)}</>;
}
