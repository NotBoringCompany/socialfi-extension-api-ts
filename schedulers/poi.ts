import cron from 'node-cron';
import { checkDailyKOSRewards, checkWeeklyKOSRewards } from '../api/kos';
import { resetGlobalItemsDailyBuyableAndSellableAmount } from '../api/poi';

/**
 * Calls `resetGlobalItemsDailyBuyableAndSellableAmount` every day at 11:59 UTC and 23:59 UTC to reset the daily buyable and sellable amount of global items.
 */
export const resetGlobalItemsDailyBuyableAndSellableAmountScheduler = async (): Promise<void> => {
    try {
        const schedules = ['59 23 * * *', '59 11 * * *'];
        
        schedules.forEach(schedule => {
            cron.schedule(schedule, async () => {
                console.log('Running resetGlobalItemsDailyBuyableAndSellableAmount...');
                await resetGlobalItemsDailyBuyableAndSellableAmount();
            });
        });
    } catch (err: any) {
        console.error('Error in resetGlobalItemsDailyBuyableAndSellableAmount:', err.message);
    }
}