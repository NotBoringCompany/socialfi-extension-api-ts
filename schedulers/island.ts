import cron from 'node-cron';
import { resetDailyIslandTappingMilestone, updateClaimableCrumbs, updateClaimableXCookies, updateDailyBonusResourcesGathered, updateGatheringProgressAndDropResource } from '../api/island';
import Bull from 'bull';
import { depleteEnergy } from '../api/bit';

export const updateGatheringProgressAndDropResourceThenDepleteEnergyQueue = new Bull('updateGatheringProgressAndDropResourceThenDepleteEnergyQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Calls `updateGatheringProgressAndDropResource` every 15 minutes to update all islands' gathering progress and drop a resource for any eligible islands.
 * 
 * Then, deplete all bits' energies.
 */
updateGatheringProgressAndDropResourceThenDepleteEnergyQueue.process(async () => {
    console.log('Running updateGatheringProgressAndDropResourceThenDepleteEnergyQueue... running updateGatheringProgressAndDropResource...');
    await updateGatheringProgressAndDropResource();

    console.log('Running updateGatheringProgressAndDropResourceThenDepleteEnergyQueue... running depleteEnergy...');
    await depleteEnergy();
});

export const updateDailyBonusResourcesGatheredQueue = new Bull('updateDailyBonusResourcesGatheredQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Calls `updateDailyBonusResourcesGathered` every day at 23:59 to reset the daily bonus resources gathered for all islands back to 0.
 */
updateDailyBonusResourcesGatheredQueue.process(async () => {
    console.log('Running updateDailyBonusResourcesGatheredQueue...');
    await updateDailyBonusResourcesGathered();
});

export const resetDailyIslandTappingMilestoneQueue = new Bull('resetDailyIslandTappingMilestoneQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Call `resetDailyIslandTappingMilestone` every day at 23:59 to reset the islandTappingData back to first Milestone
 */
resetDailyIslandTappingMilestoneQueue.process(async () => {
    console.log('Running resetDailyIslandTappingMilestoneQueue...');
    await resetDailyIslandTappingMilestone();
});

// /**
//  * Calls `updateGatheringProgressAndDropResource` every 15 minutes to update all islands' gathering progress and drop a resource for any eligible islands.
//  */
// export const updateGatheringProgressAndDropResourceScheduler = async (): Promise<void> => {
//     try {
//         cron.schedule('*/15 * * * *', async () => {
//             console.log('Running updateGatheringProgressAndDropResourceScheduler...');
//             await updateGatheringProgressAndDropResource();
//         });
//     } catch (err: any) {
//         console.error('Error in updateGatheringProgressAndDropResourceScheduler:', err.message);
//     }
// }

// /**
//  * Calls `updateDailyBonusResourcesGathered` every day at 23:59 to reset the daily bonus resources gathered for all islands back to 0.
//  */
// export const updateDailyBonusResourcesGatheredScheduler = async (): Promise<void> => {
//     try {
//         cron.schedule('59 23 * * *', async () => {
//             console.log('Running updateDailyBonusResourcesGathered...');
//             await updateDailyBonusResourcesGathered();
//         })
//     } catch (err: any) {
//         console.error('Error in updateDailyBonusResourcesGathered:', err.message);
//     }
// }

// /**
//  * Call `resetDailyIslandTappingMilestone` every day at 23:59 to reset the islandTappingData back to first Milestone
//  */
// export const resetDailyIslandTappingMilestoneScheduler = async (): Promise<void> => {
//     try {
//         cron.schedule('59 23 * * *', async () => {
//             console.log('Running resetDailyIslandTappingMilestoneScheduler...');
//             await resetDailyIslandTappingMilestone();
//         })
//     } catch (err: any) {
//         console.error('Error in resetDailyIslandTappingMilestoneScheduler:', err.message);
//     }
// };