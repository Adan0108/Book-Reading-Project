import { pool } from "../../dbs/init.mysql";
import type { FanArt } from "../fanArt.model";

/**
 * Creates a new fan art record
 */
export async function createFanArt(input: {chapterId: number; url: string;}): Promise<any> {
    const [result] = await pool.query(
        "INSERT INTO fan_arts (chapter_id, url) VALUES (?, ?)",
        [input.chapterId, input.url]
    );
    
    return result;
}

/**
 * Fetches all fan arts for a specific chapter
 */
export async function findByChapterId(chapterId: number): Promise<FanArt[]> {
    const [rows] = await pool.query(
        "SELECT * FROM fan_arts WHERE chapter_id = ? ORDER BY created_at DESC",
        [chapterId]
    );
    return rows as FanArt[];
}

/**
 * Deletes a specific fan art by its ID
 */
export async function deleteFanArtById(id: number): Promise<any> {
    const [result] = await pool.query(
      "DELETE FROM fan_arts WHERE id = ?",
      [id]
    );
    return result;
}

/**
 * Fetches a single fan art record by its ID
 */
export async function findFanArtById(id: number): Promise<FanArt | null> {
    const [rows] = await pool.query(
      "SELECT * FROM fan_arts WHERE id = ? LIMIT 1",
      [id]
    );
    return (rows as any[])[0] || null;
}