import cron from 'node-cron';
import { updateDailyLoginRewardsData } from '../api/user';

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