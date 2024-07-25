import cron from 'node-cron';
import { resetWeeklyItemsConsumed, resetWeeklyXCookiesSpent, restoreUserCurrentEnergy, updateBeginnerRewardsData, updateDailyLoginRewardsData, updateUserEnergyPotion } from '../api/user';

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

/**
 * Updates users with EnergyPotion count less than the maximum cap (4) every day
 * at 05:59, 11:59, 17:59, and 23:59 UTC
 */
export const updateUserEnergyPotionScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 5,11,17,23 * * *', async () => {
            console.log('Running updateUserEnergyPotionScheduler...');

            await updateUserEnergyPotion();
        });
    } catch (err: any) {
        console.error('Error in updateUserEnergyPotionScheduler: ', err.message);
    }   
}

/**
 * Restore user with current energy less than maximum cap every day at 23:59 UTC
 */
export const restoreUserCurrentEnergyScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * *', async () => {
            console.log('Running restoreUserCurrentEnergyScheduler...');

            await restoreUserCurrentEnergy();
        });
    } catch (err: any) {
        console.error('Error in restoreUserCurrentEnergyScheduler:', err.message);
    }
}