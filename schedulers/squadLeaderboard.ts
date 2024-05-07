import cron from 'node-cron';
import { updateClaimableCrumbs, updateClaimableXCookies, updateDailyBonusResourcesGathered, updateGatheringProgressAndDropResource } from '../api/island';
import { addSquadLeaderboard } from '../api/squadLeaderboard';

/**
 * Calls `addSquadLeaderboard` every Sunday 23:59 UTC to create a new week for the squad leaderboard.
 */
export const addSquadLeaderboardScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * 0', async () => {
            console.log('Running addSquadLeaderboardScheduler...');
            await addSquadLeaderboard();
        });
    } catch (err: any) {
        console.error('Error in updateGatheringProgressAndDropResourceScheduler:', err.message);
    }
}