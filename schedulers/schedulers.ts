import { removeOpenedTweetIdsTodayQueue } from './chest';
import { updateSuccessfulIndirectReferralsQueue } from './invite';
import { resetDailyIslandTappingMilestoneQueue, updateDailyBonusResourcesGatheredQueue, updateGatheringProgressAndDropResourceThenDepleteEnergyQueue } from './island';
import { checkDailyKOSRewardsQueue, checkWeeklyKOSRewardsQueue } from './kos';
import { scheduleNextPOIItemDataReset } from './poi';
import { calculateWeeklySquadRankingAndAddSquadLeaderboardQueue } from './squadLeaderboard';
import { restoreUserCurrentEnergyAndResetRerollQueue, updateBeginnerRewardsDataQueue, updateDailyLoginRewardsDataQueue, updateUserEnergyPotionQueue } from './user';
import { distributeWeeklyMVPRewardsQueue, updateCurrentWeeklyMVPRankingLeaderboardQueue } from './weeklyMVPReward';

export const schedulers = async (): Promise<void> => {
    try {
        // update gathering progress first because bits' energies will deplete afterwards
        await updateGatheringProgressAndDropResourceThenDepleteEnergyQueue.add({}, {
            repeat: {
                // every 15 minutes
                cron: '*/15 * * * *',
                tz: 'UTC',
            }
        });

        updateSuccessfulIndirectReferralsQueue.add({}, {
            repeat: {
                // every 15 minutes
                cron: '*/15 * * * *',
                tz: 'UTC',
            }
        });

        updateCurrentWeeklyMVPRankingLeaderboardQueue.add({}, {
            // every hour
            repeat: {
                cron: '0 * * * *',
                tz: 'UTC',
            }
        });

        removeOpenedTweetIdsTodayQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *',
                tz: 'UTC',
            }
        });

        updateDailyBonusResourcesGatheredQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *',
                tz: 'UTC',
            }
        });

        updateDailyLoginRewardsDataQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *',
                tz: 'UTC',
            }
        });

        updateBeginnerRewardsDataQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *',
                tz: 'UTC',
            }
        });

        updateUserEnergyPotionQueue.add({}, {
            // every day at 05:59, 11:59, 17:59, 23:59
            repeat: {
                cron: '59 5,11,17,23 * * *',
                tz: 'UTC',
            }
        });

        restoreUserCurrentEnergyAndResetRerollQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *',
                tz: 'UTC',
            }
        });

        // this will be a dynamic time-range randomizer to call `resetPOIItemsData` at any time on the given time ranges
        await scheduleNextPOIItemDataReset();

        resetDailyIslandTappingMilestoneQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *',
                tz: 'UTC',
            }
        });

        calculateWeeklySquadRankingAndAddSquadLeaderboardQueue.add({}, {
            // every sunday at 23:59
            repeat: {
                cron: '59 23 * * SUN',
                tz: 'UTC',
            }
        });

        distributeWeeklyMVPRewardsQueue.add({}, {
            // every sunday at 23:59
            repeat: {
                cron: '59 23 * * SUN',
                tz: 'UTC',
            }
        });

        checkDailyKOSRewardsQueue.add({}, {
            // every day at 23:59
            repeat: {
                cron: '59 23 * * *',
                tz: 'UTC',
            }
        });

        checkWeeklyKOSRewardsQueue.add({}, {
            // every sunday at 23:59
            repeat: {
                cron: '59 23 * * SUN',
                tz: 'UTC',
            }
        });
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}