import cron from 'node-cron';
import { checkArrival } from '../api/poi';

/**
 * Scheduler to update user's location data when they arrive at a POI they were travelling to.
 * 
 * This scheduler runs every 5 minutes.
 */
export const checkArrivalScheduler = async (): Promise<void> => {
    try {
        cron.schedule('*/5 * * * *', async () => {
            console.log('Running checkArrivalScheduler...');
            await checkArrival();
        })
    } catch (err: any) {
        console.error('Error in checkArrivalScheduler:', err.message);
    }
}