import cron from 'node-cron';
import { resetWeeklyItemsConsumed, resetWeeklyXCookiesSpent, restoreUserCurrentEnergyAndResetReroll, updateBeginnerRewardsData, updateDailyLoginRewardsData, updateUserEnergyPotion } from '../api/user';
import Bull from 'bull';

export const updateDailyLoginRewardsDataQueue = new Bull('updateDailyLoginRewardsDataQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Updates all users' daily login rewards data every day at 23:59 UTC
 */
updateDailyLoginRewardsDataQueue.process(async () => {
    console.log('Running updateDailyLoginRewardsDataQueue...');
    await updateDailyLoginRewardsData();
});

export const updateBeginnerRewardsDataQueue = new Bull('updateBeginnerRewardsDataQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Updates all users' beginner rewards data every day at 00:00 UTC
 */
updateBeginnerRewardsDataQueue.process(async () => {
    console.log('Running updateBeginnerRewardsDataQueue...');
    await updateBeginnerRewardsData();
});

export const updateUserEnergyPotionQueue = new Bull('updateUserEnergyPotionQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Updates users with EnergyPotion count less than the maximum cap (4) every day
 * at 05:59, 11:59, 17:59, and 23:59 UTC
 */
updateUserEnergyPotionQueue.process(async () => {
    console.log('Running updateUserEnergyPotionQueue...');
    await updateUserEnergyPotion();
});

/**
 * Restore user with current energy less than maximum cap every day at 23:59 UTC
 */
export const restoreUserCurrentEnergyAndResetRerollQueue = new Bull('restoreUserCurrentEnergyAndResetRerollQueue', {
    redis: process.env.REDIS_URL
});

restoreUserCurrentEnergyAndResetRerollQueue.process(async () => {
    console.log('Running restoreUserCurrentEnergyAndResetRerollQueue...');
    await restoreUserCurrentEnergyAndResetReroll();
});