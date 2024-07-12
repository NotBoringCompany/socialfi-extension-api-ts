import cron from 'node-cron';
import { updateSuccessfulIndirectReferrals } from '../api/invite';

/**
 * Calls `updateSuccessfulIndirectReferrals` every hour to update the user's indirect referrals.
 */
export const updateSuccessfulIndirectReferralsScheduler = async (): Promise<void> => {
    try {
        cron.schedule('0 * * * *', async () => {
            console.log('Running updateSuccessfulIndirectReferralsScheduler...');
            await updateSuccessfulIndirectReferrals();
        });
    } catch (err: any) {
        console.error('Error in updateSuccessfulIndirectReferralsScheduler:', err.message);
    }
}