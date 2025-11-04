import { cleanupStaleUsers } from "../models/repositories/user.repo";

export const runUserCleanup = async () => {
  console.log('[Scheduler] Running stale user cleanup task...');
  try {
    const deletedCount = await cleanupStaleUsers(24); // Deletes accounts older than 24 hours
    if (deletedCount > 0) {
      console.log(`[Scheduler] ✅ Cleaned up ${deletedCount} stale users.`);
    } else {
      console.log(`[Scheduler] ✅ No stale users to clean up.`);
    }
  } catch (error) {
    console.error(`[Scheduler] ❌ Error during user cleanup:`, error);
  }
};