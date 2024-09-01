import { depleteEnergyScheduler } from './bit';
import { removeOpenedTweetIdsTodayScheduler } from './chest';
import { updateSuccessfulIndirectReferralsScheduler } from './invite';
import { resetDailyIslandTappingMilestoneScheduler, updateClaimableCrumbsScheduler, updateClaimableXCookiesScheduler, updateDailyBonusResourcesGatheredScheduler, updateGatheringProgressAndDropResourceScheduler } from './island';
import { checkDailyKOSRewardsScheduler, checkWeeklyKOSRewardsScheduler } from './kos';
import { resetGlobalItemsDailyBuyableAndSellableAmountScheduler } from './poi';
import { calculateWeeklySquadRankingAndAddSquadLeaderboardScheduler } from './squadLeaderboard';
import { restoreUserCurrentEnergyAndResetRerollScheduler, updateBeginnerRewardsDataScheduler, updateDailyLoginRewardsDataScheduler, updateUserEnergyPotionScheduler } from './user';
import { batchSendKICKScheduler } from './web3';
import { distributeWeeklyMVPRewardsScheduler, updateCurrentWeeklyMVPRankingLeaderboardScheduler } from './weeklyMVPReward';

export const schedulers = async (): Promise<void> => {
    try {
        // update gathering progress first because bits' energies will deplete afterwards
        await updateGatheringProgressAndDropResourceScheduler();
        // await updateClaimableXCookiesScheduler();
        // await updateClaimableCrumbsScheduler();
        await depleteEnergyScheduler();

        updateSuccessfulIndirectReferralsScheduler();
        
        updateCurrentWeeklyMVPRankingLeaderboardScheduler();

        batchSendKICKScheduler();

        removeOpenedTweetIdsTodayScheduler();
        updateDailyBonusResourcesGatheredScheduler();
        updateDailyLoginRewardsDataScheduler();
        updateBeginnerRewardsDataScheduler();
        updateUserEnergyPotionScheduler();
        restoreUserCurrentEnergyAndResetRerollScheduler();
        resetGlobalItemsDailyBuyableAndSellableAmountScheduler();
        resetDailyIslandTappingMilestoneScheduler();

        calculateWeeklySquadRankingAndAddSquadLeaderboardScheduler();

        distributeWeeklyMVPRewardsScheduler();

        checkDailyKOSRewardsScheduler();
        checkWeeklyKOSRewardsScheduler();
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}