import cron from 'node-cron';
import { depleteEnergy } from '../api/bit';

/**
 * Calls `depleteEnergy` every 10 minutes and depletes all bit energ
 */
export const depleteEnergyScheduler = async (): Promise<void> => {
    try {
        cron.schedule('*/10 * * * *', async () => {
            console.log('Running updateGatheringProgressAndDropResourceScheduler...');
            await depleteEnergy();
        });
    } catch (err: any) {
        console.error('Error in updateGatheringProgressAndDropResourceScheduler:', err.message);
    }
}