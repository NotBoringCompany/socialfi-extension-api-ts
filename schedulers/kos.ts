import cron from 'node-cron';
import { checkDailyKOSRewards, checkWeeklyKOSRewards } from '../api/kos';
import Bull from 'bull';

export const checkDailyKOSRewardsQueue = new Bull('checkDailyKOSRewardsQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Calls `checkDailyKOSRewards` every day at 23:59 to check if any users are eligible for the daily KOS rewards.
 */
checkDailyKOSRewardsQueue.process(async () => {
    console.log('Running checkDailyKOSRewards...');
    await checkDailyKOSRewards();
});

export const checkWeeklyKOSRewardsQueue = new Bull('checkWeeklyKOSRewardsQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Calls `checkWeeklyKOSRewards` every Sunday at 23:59 UTC to check if any users are eligible for the weekly KOS rewards.
 */
checkWeeklyKOSRewardsQueue.process(async () => {
    console.log('Running checkWeeklyKOSRewards...');
    await checkWeeklyKOSRewards();
});