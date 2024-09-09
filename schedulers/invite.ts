import cron from 'node-cron';
import { updateSuccessfulIndirectReferrals } from '../api/invite';
import Bull from 'bull';

export const updateSuccessfulIndirectReferralsQueue = new Bull('updateSuccessfulIndirectReferralsQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Calls `updateSuccessfulIndirectReferrals` every 5 minutes to update the user's indirect referrals.
 */
updateSuccessfulIndirectReferralsQueue.process(async () => {
    console.log('Running depleteEnergyQueue...');
    await updateSuccessfulIndirectReferrals();
});
