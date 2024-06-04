import cron from 'node-cron';
import { resetWeeklyItemsConsumed, resetWeeklyXCookiesSpent, updateBeginnerRewardsData, updateDailyLoginRewardsData } from '../api/user';

/**
 * Updates all users' daily login rewards data every day at 00:00 UTC
 */
export const updateDailyLoginRewardsDataScheduler = async (): Promise<void> => {
    try {
        cron.schedule('0 0 * * *', async () => {
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
        cron.schedule('0 0 * * *', async () => {
            console.log('Running updateBeginnerRewardsData...');

            await updateBeginnerRewardsData();
        });
    } catch (err: any) {
        console.error('Error in updateBeginnerRewardsData:', err.message);
    }
}

/**
 * Updates all users' `weeklyXCookiesSpent` to 0 every Sunday 23:59 UTC
 */
export const resetWeeklyXCookiesSpentScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * 0', async () => {
            console.log('Running resetWeeklyXCookiesSpent...');

            await resetWeeklyXCookiesSpent();
        });
    } catch (err: any) {
        console.error('Error in resetWeeklyXCookiesSpent:', err.message);
    }
}

/**
 * Updates all users' `weeklyAmountConsumed` for each item in their inventory to 0 every Sunday 23:59 UTC
 */
export const resetWeeklyItemsConsumedScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * 0', async () => {
            console.log('Running resetWeeklyAmountConsumed...');

            await resetWeeklyItemsConsumed();
        });
    } catch (err: any) {
        console.error('Error in resetWeeklyAmountConsumed:', err.message);
    }
}