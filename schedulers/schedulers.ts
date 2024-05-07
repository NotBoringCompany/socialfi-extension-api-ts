import { depleteEnergyScheduler } from './bit';
import { removeOpenedTweetIdsTodayScheduler } from './chest';
import { updateClaimableCrumbsScheduler, updateClaimableXCookiesScheduler, updateDailyBonusResourcesGatheredScheduler, updateGatheringProgressAndDropResourceScheduler } from './island';
import { calculateWeeklySquadRankingAndAddSquadLeaderboardScheduler } from './squadLeaderboard';
import { updateBeginnerRewardsDataScheduler, updateDailyLoginRewardsDataScheduler } from './user';

export const schedulers = async (): Promise<void> => {
    try {
        // update gathering progress first because bits' energies will deplete afterwards
        await updateGatheringProgressAndDropResourceScheduler();
        await updateClaimableXCookiesScheduler();
        await updateClaimableCrumbsScheduler();
        await depleteEnergyScheduler();

        await removeOpenedTweetIdsTodayScheduler();
        await updateDailyBonusResourcesGatheredScheduler();
        await updateDailyLoginRewardsDataScheduler();
        await updateBeginnerRewardsDataScheduler();

        await calculateWeeklySquadRankingAndAddSquadLeaderboardScheduler();
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}