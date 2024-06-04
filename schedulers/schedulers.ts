import { depleteEnergyScheduler } from './bit';
import { removeOpenedTweetIdsTodayScheduler } from './chest';
import { updateClaimableCrumbsScheduler, updateClaimableXCookiesScheduler, updateDailyBonusResourcesGatheredScheduler, updateGatheringProgressAndDropResourceScheduler } from './island';
import { checkDailyKOSRewardsScheduler, checkWeeklyKOSRewardsScheduler } from './kos';
import { calculateWeeklySquadRankingAndAddSquadLeaderboardScheduler } from './squadLeaderboard';
import { resetWeeklyItemsConsumedScheduler, resetWeeklyXCookiesSpentScheduler, updateBeginnerRewardsDataScheduler, updateDailyLoginRewardsDataScheduler } from './user';

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

        await resetWeeklyXCookiesSpentScheduler();
        await resetWeeklyItemsConsumedScheduler();

        await checkDailyKOSRewardsScheduler();
        await checkWeeklyKOSRewardsScheduler();
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}