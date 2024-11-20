import cron from 'node-cron';
import { updateDailyBonusResourcesGathered, updateGatheringProgressAndDropResource } from '../api/island';
import { addSquadLeaderboard, calculateWeeklySquadRankingAndGiveRewards } from '../api/squadLeaderboard';
import Bull from 'bull';

export const calculateWeeklySquadRankingAndAddSquadLeaderboardQueue = new Bull('calculateWeeklySquadRankingAndAddSquadLeaderboardQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Calls `calculateWeeklySquadRanking` every Sunday 23:59 UTC to calculate the points earned by each squad and assign a rank to each squad.
 * 
 * It then calls `addSquadLeaderboard` to create a new week for the squad leaderboard.
 */
calculateWeeklySquadRankingAndAddSquadLeaderboardQueue.process(async () => {
    console.log('Running calculateWeeklySquadRankingAndAddSquadLeaderboardQueue...');
    await calculateWeeklySquadRankingAndGiveRewards();
    await addSquadLeaderboard();
});