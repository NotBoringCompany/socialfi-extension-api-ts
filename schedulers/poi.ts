import cron from 'node-cron';
import { checkDailyKOSRewards, checkWeeklyKOSRewards } from '../api/kos';
import { resetGlobalItemsDailyBuyableAndSellableAmount } from '../api/poi';

import Bull from 'bull';

export const resetGlobalItemsDailyBuyableAndSellableAmountQueue = new Bull('resetGlobalItemsDailyBuyableAndSellableAmountQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Calls `resetGlobalItemsDailyBuyableAndSellableAmount` every day at 23:59 UTC to reset the daily buyable and sellable amount of global items.
 */
resetGlobalItemsDailyBuyableAndSellableAmountQueue.process(async () => {
    console.log('Running resetGlobalItemsDailyBuyableAndSellableAmount...');
    await resetGlobalItemsDailyBuyableAndSellableAmount();
});

// /**
//  * Calls `resetGlobalItemsDailyBuyableAndSellableAmount` every day at 23:59 UTC to reset the daily buyable and sellable amount of global items.
//  */
// export const resetGlobalItemsDailyBuyableAndSellableAmountScheduler = async (): Promise<void> => {
//     try {
//         cron.schedule('59 23 * * *', async () => {
//             console.log('Running resetGlobalItemsDailyBuyableAndSellableAmount...');
//             await resetGlobalItemsDailyBuyableAndSellableAmount();
//         });
//     } catch (err: any) {
//         console.error('Error in resetGlobalItemsDailyBuyableAndSellableAmount:', err.message);
//     }
// }