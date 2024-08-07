import cron from 'node-cron';
import { depleteEnergy } from '../api/bit';

/**
 * Calls `depleteEnergy` every 5 minutes and depletes all bits' energies.
 */
export const depleteEnergyScheduler = async (): Promise<void> => {
    try {
        cron.schedule('*/5 * * * *', async () => {
            console.log('Running depleteEnergyScheduler...');
            await depleteEnergy();
        });
    } catch (err: any) {
        console.error('Error in depleteEnergyScheduler:', err.message);
    }
}