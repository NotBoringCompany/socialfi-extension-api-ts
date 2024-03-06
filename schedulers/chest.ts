import cron from 'node-cron';
import { removeOpenedTweetIdsToday } from '../api/chest';

/**
 * Scheduler to remove all opened tweet IDs from the user's `openedTweetIdsToday` array.
 * 
 * This scheduler runs every day at 23:59 UTC.
 */
export const removeOpenedTweetIdsTodayScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * *', async () => {
            console.log('Running removeOpenedTweetIdsTodayScheduler...');
            await removeOpenedTweetIdsToday();
        });
    } catch (err: any) {
        console.error('Error in removeOpenedTweetIdsTodayScheduler:', err.message);
    }
}