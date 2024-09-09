import cron from 'node-cron';
import { removeOpenedTweetIdsToday } from '../api/chest';
import Bull from 'bull';

export const removeOpenedTweetIdsTodayQueue = new Bull('removeOpenedTweetIdsTodayQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Scheduler to remove all opened tweet IDs from the user's `openedTweetIdsToday` array.
 * 
 * This scheduler runs every day at 23:59 UTC.
 */
removeOpenedTweetIdsTodayQueue.process(async () => {
    console.log('Running removeOpenedTweetIdsTodayQueue...');
    await removeOpenedTweetIdsToday();
});