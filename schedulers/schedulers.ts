import { removeOpenedTweetIdsTodayQueue } from './chest';
import { updateSuccessfulIndirectReferralsQueue } from './invite';
import { resetDailyIslandTappingMilestoneQueue, updateDailyBonusResourcesGatheredQueue, updateGatheringProgressAndDropResourceThenDepleteEnergyQueue } from './island';
import { checkDailyKOSRewardsQueue, checkWeeklyKOSRewardsQueue } from './kos';
import { resetGlobalItemsDailyBuyableAndSellableAmountQueue } from './poi';
import { calculateWeeklySquadRankingAndAddSquadLeaderboardQueue } from './squadLeaderboard';
import { restoreUserCurrentEnergyAndResetRerollQueue, updateBeginnerRewardsDataQueue, updateDailyLoginRewardsDataQueue, updateUserEnergyPotionQueue } from './user';
import { batchSendKICKQueue } from './web3';
import { distributeWeeklyMVPRewardsQueue, updateCurrentWeeklyMVPRankingLeaderboardQueue } from './weeklyMVPReward';

export const schedulers = async (): Promise<void> => {
    try {
        // update gathering progress first because bits' energies will deplete afterwards
        await updateGatheringProgressAndDropResourceThenDepleteEnergyQueue.add({}, {
            repeat: {
                // every 15 minutes
                cron: '*/15 * * * *'
            }
        });

        updateSuccessfulIndirectReferralsQueue.add({}, {
            repeat: {
                // every 15 minutes
                cron: '*/15 * * * *'
            }
        });

        updateCurrentWeeklyMVPRankingLeaderboardQueue.add({}, {
            // every hour
            repeat: {
                cron: '0 * * * *'
            }
        });

        batchSendKICKQueue.add({}, {
            // every hour
            repeat: {
                cron: '0 * * * *'
            }
        });

        removeOpenedTweetIdsTodayQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *'
            }
        });

        updateDailyBonusResourcesGatheredQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *'
            }
        });

        updateDailyLoginRewardsDataQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *'
            }
        });

        updateBeginnerRewardsDataQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *'
            }
        });

        updateUserEnergyPotionQueue.add({}, {
            // every day at 05:59, 11:59, 17:59, 23:59
            repeat: {
                cron: '59 5,11,17,23 * * *'
            }
        });

        restoreUserCurrentEnergyAndResetRerollQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *'
            }
        });

        resetGlobalItemsDailyBuyableAndSellableAmountQueue.add({}, {
            // every day at 11:59 and 23:59
            repeat: {
                cron: '59 11,23 * * *'
            }
        });

        resetDailyIslandTappingMilestoneQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *'
            }
        });

        calculateWeeklySquadRankingAndAddSquadLeaderboardQueue.add({}, {
            // every sunday at 23:59
            repeat: {
                cron: '59 23 * * SUN'
            }
        });

        distributeWeeklyMVPRewardsQueue.add({}, {
            // every sunday at 23:59
            repeat: {
                cron: '59 23 * * SUN'
            }
        });

        checkDailyKOSRewardsQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *'
            }
        });

        checkWeeklyKOSRewardsQueue.add({}, {
            // every sunday at 23:59
            repeat: {
                cron: '59 23 * * SUN'
            }
        });
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}