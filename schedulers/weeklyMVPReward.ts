import cron from 'node-cron';
import { addNewWeeklyMVPRankingLeaderboard, distributeWeeklyMVPRewards, updateCurrentWeeklyMVPRankingLeaderboard } from '../api/weeklyMVPReward';
import { resetWeeklyItemsConsumed, resetWeeklyXCookiesSpent } from '../api/user';
import Bull from 'bull';

export const distributeWeeklyMVPRewardsQueue = new Bull('distributeWeeklyMVPRewardsQueue', {
    redis: process.env.REDIS_URL
});

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
distributeWeeklyMVPRewardsQueue.process(async () => {
    console.log('Running distributeWeeklyMVPRewardsQueue...');
    await distributeWeeklyMVPRewards();
    await updateCurrentWeeklyMVPRankingLeaderboard();
    await resetWeeklyXCookiesSpent();
    await resetWeeklyItemsConsumed();
    await addNewWeeklyMVPRankingLeaderboard();
});

export const updateCurrentWeeklyMVPRankingLeaderboardQueue = new Bull('updateCurrentWeeklyMVPRankingLeaderboardQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Calls `updateCurrentWeeklyMVPRankingLeaderboard` to update the current weekly MVP ranking leaderboard every hour
 */
updateCurrentWeeklyMVPRankingLeaderboardQueue.process(async () => {
    console.log('Running updateCurrentWeeklyMVPRankingLeaderboardQueue...');
    await updateCurrentWeeklyMVPRankingLeaderboard();
});
