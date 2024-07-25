import { depleteEnergyScheduler } from './bit';
import { removeOpenedTweetIdsTodayScheduler } from './chest';
import { updateSuccessfulIndirectReferralsScheduler } from './invite';
import { resetDailyIslandTappingMilestoneScheduler, updateClaimableCrumbsScheduler, updateClaimableXCookiesScheduler, updateDailyBonusResourcesGatheredScheduler, updateGatheringProgressAndDropResourceScheduler } from './island';
import { checkDailyKOSRewardsScheduler, checkWeeklyKOSRewardsScheduler } from './kos';
import { resetGlobalItemsDailyBuyableAndSellableAmountScheduler } from './poi';
import { calculateWeeklySquadRankingAndAddSquadLeaderboardScheduler } from './squadLeaderboard';
import { updateBeginnerRewardsDataScheduler, updateDailyLoginRewardsDataScheduler, updateUserEnergyPotionScheduler } from './user';
import { batchSendKICKScheduler } from './web3';
import { distributeWeeklyMVPRewardsScheduler, updateCurrentWeeklyMVPRankingLeaderboardScheduler } from './weeklyMVPReward';

export const schedulers = async (): Promise<void> => {
    try {
        // update gathering progress first because bits' energies will deplete afterwards
        await updateGatheringProgressAndDropResourceScheduler();
        await updateClaimableXCookiesScheduler();
        await updateClaimableCrumbsScheduler();
        await depleteEnergyScheduler();

        await updateSuccessfulIndirectReferralsScheduler();
        
        await updateCurrentWeeklyMVPRankingLeaderboardScheduler();

        await batchSendKICKScheduler();

        await removeOpenedTweetIdsTodayScheduler();
        await updateDailyBonusResourcesGatheredScheduler();
        await updateDailyLoginRewardsDataScheduler();
        await updateBeginnerRewardsDataScheduler();
        await updateUserEnergyPotionScheduler();
        await resetGlobalItemsDailyBuyableAndSellableAmountScheduler();
        await resetDailyIslandTappingMilestoneScheduler();

        await calculateWeeklySquadRankingAndAddSquadLeaderboardScheduler();

        await distributeWeeklyMVPRewardsScheduler();

        await checkDailyKOSRewardsScheduler();
        await checkWeeklyKOSRewardsScheduler();
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}