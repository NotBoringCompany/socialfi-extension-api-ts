import cron from 'node-cron';
import { updateClaimableSeaweed } from '../api/raft';

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