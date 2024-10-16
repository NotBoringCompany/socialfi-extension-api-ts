import cron from 'node-cron';
import { checkDailyKOSRewards, checkWeeklyKOSRewards } from '../api/kos';
import { resetPOIItemsDailyData } from '../api/poi';

import Bull from 'bull';

export const resetPOIItemsDailyDataQueue = new Bull('resetPOIItemsDailyDataQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Calls `resetPOIItemsDailyData` every day at 23:59 UTC to reset the daily buyable and sellable amount of global items.
 */
resetPOIItemsDailyDataQueue.process(async () => {
    console.log('Running resetPOIItemsDailyData...');
    await resetPOIItemsDailyData();
});