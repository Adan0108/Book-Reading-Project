import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../../dbs/init.mysql";
import {
  parseNovelDocument,
  type NovelDocument,
} from "../../domain/novelDocument";

export async function getChapterDocument(
  chapterId: number,
  db: Pick<PoolConnection, "query"> = pool,
): Promise<NovelDocument | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT document_json FROM chapter_documents WHERE chapter_id=?",
    [chapterId],
  );
  if (!rows[0]) return null;
  return parseNovelDocument(
    typeof rows[0].document_json === "string"
      ? JSON.parse(rows[0].document_json)
      : rows[0].document_json,
  );
}
export async function saveChapterDocument(
  db: PoolConnection,
  chapterId: number,
  document: NovelDocument,
) {
  await db.query(
    "INSERT INTO chapter_documents(chapter_id,schema_version,document_json) VALUES (?,1,?) ON DUPLICATE KEY UPDATE schema_version=1,document_json=VALUES(document_json)",
    [chapterId, JSON.stringify(document)],
  );
}
