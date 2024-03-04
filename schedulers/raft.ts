import cron from 'node-cron';
import { updateClaimableSeaweed } from '../api/raft';

/**
 * Calls `updateClaimableSeaweed` every 10 minutes to update all rafts' claimable seaweed.
 */
export const updateClaimableSeaweedScheduler = async (): Promise<void> => {
    try {
        cron.schedule('*/10 * * * *', async () => {
            console.log('Running updateClaimableSeaweedScheduler...');
            await updateClaimableSeaweed();
        });
    } catch (err: any) {
        console.error('Error in updateClaimableSeaweedScheduler:', err.message);
    }
}