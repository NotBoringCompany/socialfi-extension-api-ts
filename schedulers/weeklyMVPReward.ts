import cron from 'node-cron';
import { addNewWeeklyMVPRankingLeaderboard, distributeWeeklyMVPRewards, updateCurrentWeeklyMVPRankingLeaderboard } from '../api/weeklyMVPReward';
import { resetWeeklyItemsConsumed, resetWeeklyXCookiesSpent } from '../api/user';

/**
 * Does a few things:
 * 
 * 1. Calls `distributeWeeklyMVPRewards` to distribute the weekly MVP rewards to the users who spends the most xCookies or consumes the most bit orbs/terra caps/.
 * 2. Calls `updateCurrentWeeklyMVPRankingLeaderboard` to update the current weekly MVP ranking leaderboard one last time before a new leaderboard is added.
 * 3. Calls `resetWeeklyXCookiesSpent` and `resetWeeklyItemsConsumed` to reset the weekly xCookies spent and weekly items consumed for each user after #1 is called.
 * 4. Calls `addNewWeeklyMVPRankingLeaderboard` to add a new weekly MVP ranking leaderboard.
 * 
 * Called every 23:59 UTC Sunday 
 */
export const distributeWeeklyMVPRewardsScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * 0', async () => {
            console.log('Running distributeWeeklyMVPRewards...');

            await distributeWeeklyMVPRewards();
            await updateCurrentWeeklyMVPRankingLeaderboard();
            await resetWeeklyXCookiesSpent();
            await resetWeeklyItemsConsumed();

            // add new ranking leaderboard
            await addNewWeeklyMVPRankingLeaderboard();
        });
    } catch (err: any) {
        console.error('Error in distributeWeeklyMVPRewards:', err.message);
    }
}

/**
 * Calls `updateCurrentWeeklyMVPRankingLeaderboard` to update the current weekly MVP ranking leaderboard every hour.
 */
export const updateCurrentWeeklyMVPRankingLeaderboardScheduler = async (): Promise<void> => {
    try {
        // run every hour
        cron.schedule('0 * * * *', async () => {
            console.log('Running updateCurrentWeeklyMVPRankingLeaderboard...');

            await updateCurrentWeeklyMVPRankingLeaderboard();
        });
    } catch (err: any) {
        console.error('Error in updateCurrentWeeklyMVPRankingLeaderboard:', err.message);
    }
}