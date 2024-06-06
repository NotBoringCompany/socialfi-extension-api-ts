import cron from 'node-cron';
import { distributeWeeklyMVPRewards } from '../api/weeklyMVPReward';
import { resetWeeklyItemsConsumed, resetWeeklyXCookiesSpent } from '../api/user';

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