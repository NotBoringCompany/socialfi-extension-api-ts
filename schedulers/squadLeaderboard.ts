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

// /**
//  * Calls `calculateWeeklySquadRanking` every Sunday 23:59 UTC to calculate the points earned by each squad and assign a rank to each squad.
//  * 
//  * It then calls `addSquadLeaderboard` to create a new week for the squad leaderboard.
//  */
// export const calculateWeeklySquadRankingAndAddSquadLeaderboardScheduler = async (): Promise<void> => {
//     try {
//         cron.schedule('59 23 * * 0', async () => {
//             console.log('Running calculateWeeklySquadRankingAndAddSquadLeaderboardScheduler...');
//             await calculateWeeklySquadRankingAndGiveRewards();
//             await addSquadLeaderboard();
//         });
//     } catch (err: any) {
//         console.error('Error in calculateWeeklySquadRankingAndAddSquadLeaderboardScheduler:', err.message);
//     }
// }