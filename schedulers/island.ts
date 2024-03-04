import cron from 'node-cron';
import { updateGatheringProgressAndDropResource } from '../api/island';

/**
 * Calls `updateGatheringProgressAndDropResource` every 10 minutes to update all islands' gathering progress and drop a resource for any eligible islands.
 */
export const updateGatheringProgressAndDropResourceScheduler = async (): Promise<void> => {
    try {
        cron.schedule('*/10 * * * *', async () => {
            console.log('Running updateGatheringProgressAndDropResourceScheduler...');
            await updateGatheringProgressAndDropResource();
        });
    } catch (err: any) {
        console.error('Error in updateGatheringProgressAndDropResourceScheduler:', err.message);
    }
}