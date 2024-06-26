import cron from 'node-cron';
import { resetWeeklyItemsConsumed, resetWeeklyXCookiesSpent, updateBeginnerRewardsData, updateDailyLoginRewardsData } from '../api/user';

/**
 * Updates all users' daily login rewards data every day at 23:59 UTC
 */
export const updateDailyLoginRewardsDataScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * *', async () => {
            console.log('Running updateDailyLoginRewardsData...');

            await updateDailyLoginRewardsData();
        });
    } catch (err: any) {
        console.error('Error in updateDailyLoginRewardsData:', err.message);
    }
}

/**
 * Updates all users' beginner rewards data every day at 00:00 UTC
 */
export const updateBeginnerRewardsDataScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * *', async () => {
            console.log('Running updateBeginnerRewardsData...');

            await updateBeginnerRewardsData();
        });
    } catch (err: any) {
        console.error('Error in updateBeginnerRewardsData:', err.message);
    }
}