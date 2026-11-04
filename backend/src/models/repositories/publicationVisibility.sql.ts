export type ContentKind = "BOOK" | "CHAPTER" | "POST";
// Aliases come only from static repository queries, never request parameters.
export function notHiddenSql(kind: ContentKind, alias: string) {
  return `NOT EXISTS(SELECT 1 FROM moderation_flags mf WHERE mf.kind='${kind}' AND mf.resource_id=${alias}.id AND mf.hidden=1)`;
}
export function publicBookSql(alias: string) {
  return `${alias}.deleted_at IS NULL AND ${alias}.status='PUBLISHED' AND ${notHiddenSql("BOOK", alias)}
    AND EXISTS(SELECT 1 FROM authors va JOIN users vu ON vu.id=va.user_id WHERE va.id=${alias}.author_id AND va.is_approved=1 AND vu.state=1)`;
}
export function releasedChapterSql(alias: string) {
  return `${alias}.deleted_at IS NULL AND ${alias}.is_draft=0 AND ${alias}.published_at<=NOW()
    AND (${alias}.scheduled_at IS NULL OR ${alias}.scheduled_at<=NOW()) AND ${notHiddenSql("CHAPTER", alias)}`;
}
