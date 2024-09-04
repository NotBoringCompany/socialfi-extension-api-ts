import cron from 'node-cron';
import { resetWeeklyItemsConsumed, resetWeeklyXCookiesSpent, restoreUserCurrentEnergyAndResetReroll, updateBeginnerRewardsData, updateDailyLoginRewardsData, updateUserEnergyPotion } from '../api/user';

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
export const restoreUserCurrentEnergyAndResetRerollScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * *', async () => {
            console.log('Running restoreUserCurrentEnergyAndResetRerollScheduler...');

            await restoreUserCurrentEnergyAndResetReroll();
        });
    } catch (err: any) {
        console.error('Error in restoreUserCurrentEnergyAndResetRerollScheduler:', err.message);
    }
}

/**
 * Test Randomize Scheduler Timer Between 1 Minute Range - 5 Minute Range
 */
export const testRandomizeSchedulerTimer = async (): Promise<void> => {
    try {
        // Function to set a random timeout
        const scheduleRandomTask = () => {
            // Generate a random interval between 1 and 5 minutes
            const minInterval = 1; // Minimum 1 minute
            const maxInterval = 5; // Maximum 5 minutes
            const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval + 1) + minInterval); // Random interval between 1 and 5
    
            console.log(`(testRandomizeSchedulerTimer) Scheduled job to run in ${randomInterval} minutes`);
    
            // Schedule the task using setTimeout
            setTimeout(() => {
            console.log(`(testRandomizeSchedulerTimer) Task executed after ${randomInterval} minutes`);
            // Your logic here
    
            // Reschedule the task again with a new random interval
            scheduleRandomTask();
            }, randomInterval * 60 * 1000); // Convert minutes to milliseconds
        };
  
        // Start the initial schedule
        scheduleRandomTask();
    } catch (err: any) {
      console.error('Error in testRandomizeSchedulerTimer: ', err.message);
    }
};