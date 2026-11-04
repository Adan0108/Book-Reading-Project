import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../../dbs/init.mysql";
import { BadRequestError, ForbiddenError } from "../../core/error.response";
type Database = Pick<PoolConnection, "query">;
export type AssetPurpose = "cover" | "chapter" | "post";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Called under the owning author lock. A confirmed asset has exactly one permitted consumer type.
export async function attachable(
  db: Database,
  id: string,
  authorId: number,
  purpose: AssetPurpose,
  bookId?: number,
  chapterId?: number,
  postId?: number,
) {
  if (typeof id !== "string" || !uuid.test(id))
    throw new BadRequestError("Invalid asset ID");
  const [assets] = await db.query<RowDataPacket[]>(
    "SELECT * FROM publishing_assets WHERE id = ? FOR UPDATE",
    [id],
  );
  const asset = assets[0];
  if (
    !asset ||
    Number(asset.author_id) !== Number(authorId) ||
    asset.purpose !== purpose ||
    !asset.confirmed_at ||
    (asset.book_id !== null && Number(asset.book_id) !== bookId)
  )
    throw new ForbiddenError("Image is not authorized for this work");
  const consumers = {
    cover: ["book_covers", "book_id", bookId],
    chapter: ["chapter_images", "chapter_id", chapterId],
    post: ["post_images", "post_id", postId],
  } as const;
  const [table, column, target] = consumers[purpose];
  const [used] = await db.query<RowDataPacket[]>(
    `SELECT ${column} AS target FROM ${table} WHERE asset_id = ?`,
    [id],
  );
  if (used.length && Number(used[0].target) !== target)
    throw new ForbiddenError("Image is already attached to another work");
  return asset;
}
export async function postImages(postIds: number[], db: Database = pool) {
  if (!postIds.length) return [];
  const [images] = await db.query<RowDataPacket[]>(
    `SELECT i.post_id AS postId,a.id,a.image_url AS imageUrl,i.image_order AS pageOrder
    FROM post_images i JOIN publishing_assets a ON a.id=i.asset_id WHERE i.post_id IN (?) ORDER BY i.post_id,i.image_order`,
    [postIds],
  );
  return images.map((i) => ({
    postId: Number(i.postId),
    id: String(i.id),
    imageUrl: String(i.imageUrl),
    pageOrder: Number(i.pageOrder),
  }));
}
