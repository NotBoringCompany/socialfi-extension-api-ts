import cron from 'node-cron';
import { updateClaimableCrumbs, updateClaimableXCookies, updateDailyBonusResourcesGathered, updateGatheringProgressAndDropResource } from '../api/island';

/**
 * Calls `updateGatheringProgressAndDropResource` every 3 minutes to update all islands' gathering progress and drop a resource for any eligible islands.
 */
export const updateGatheringProgressAndDropResourceScheduler = async (): Promise<void> => {
    try {
        cron.schedule('*/3 * * * *', async () => {
            console.log('Running updateGatheringProgressAndDropResourceScheduler...');
            await updateGatheringProgressAndDropResource();
        });
    } catch (err: any) {
        console.error('Error in updateGatheringProgressAndDropResourceScheduler:', err.message);
    }
}

/**
 * Calls `updateClaimableXCookies` every 10 minutes to update all islands' claimable xCookies.
 */
export const updateClaimableXCookiesScheduler = async (): Promise<void> => {
    try {
        cron.schedule('*/10 * * * *', async () => {
            console.log('Running updateClaimableXCookiesScheduler...');
            await updateClaimableXCookies();
        });
    } catch (err: any) {
        console.error('Error in updateClaimableXCookiesScheduler:', err.message);
    }
}

/**
 * Calls `updateClaimableCrumbs` every 10 minutes to update all islands' claimable crumbs.
 */
export const updateClaimableCrumbsScheduler = async (): Promise<void> => {
    try {
        cron.schedule('*/10 * * * *', async () => {
            console.log('Running updateClaimableCrumbsScheduler...');
            await updateClaimableCrumbs();
        });
    } catch (err: any) {
        console.error('Error in updateClaimableCrumbsScheduler:', err.message);
    }
}

/**
 * Calls `updateDailyBonusResourcesGathered` every day at 23:59 to reset the daily bonus resources gathered for all islands back to 0.
 */
export const updateDailyBonusResourcesGatheredScheduler = async (): Promise<void> => {
    try {
        cron.schedule('59 23 * * *', async () => {
            console.log('Running updateDailyBonusResourcesGathered...');
            await updateDailyBonusResourcesGathered();
        })
    } catch (err: any) {
        console.error('Error in updateDailyBonusResourcesGathered:', err.message);
    }
}
