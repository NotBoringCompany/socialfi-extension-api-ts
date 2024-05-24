import cron from 'node-cron';
import { checkDailyKOSRewards, checkWeeklyKOSRewards } from '../api/kos';

/**
 * Calls `checkDailyKOSRewards` every day at 23:59 to check if any users are eligible for the daily KOS rewards.
 */
export const checkDailyKOSRewardsScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * *', async () => {
            console.log('Running checkDailyKOSRewards...');
            await checkDailyKOSRewards();
        });
    } catch (err: any) {
        console.error('Error in checkDailyKOSRewards:', err.message);
    }
}

/**
 * Calls `checkWeeklyKOSRewards` every Sunday at 23:59 UTC to check if any users are eligible for the weekly KOS rewards.
 */
export const checkWeeklyKOSRewardsScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * 0', async () => {
            console.log('Running checkWeeklyKOSRewards...');
            await checkWeeklyKOSRewards();
        });
    } catch (err: any) {
        console.error('Error in checkWeeklyKOSRewards:', err.message);
    }
}