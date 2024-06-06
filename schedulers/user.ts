import cron from 'node-cron';
import { distributeWeeklyMVPRewards, resetWeeklyItemsConsumed, resetWeeklyXCookiesSpent, updateBeginnerRewardsData, updateDailyLoginRewardsData } from '../api/user';

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
 * Does a few things:
 * 
 * 1. Calls `distributeWeeklyMVPRewards` to distribute the weekly MVP rewards to the users who spends the most xCookies or consumes the most bit orbs/terra caps
 * 2. Calls `resetWeeklyXCookiesSpent` and `resetWeeklyItemsConsumed` to reset the weekly xCookies spent and weekly items consumed for each user after #1 is called.
 * 
 * Called every 23:59 UTC Sunday 
 */
export const distributeWeeklyMVPRewardsScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * 0', async () => {
            console.log('Running distributeWeeklyMVPRewards...');

            await distributeWeeklyMVPRewards();

            await resetWeeklyXCookiesSpent();
            await resetWeeklyItemsConsumed();
        });
    } catch (err: any) {
        console.error('Error in distributeWeeklyMVPRewards:', err.message);
    }
}