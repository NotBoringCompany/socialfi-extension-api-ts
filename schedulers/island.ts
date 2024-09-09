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