import cron from 'node-cron';
import { batchSendKICK } from '../api/web3';

/**
 * Calls `batchSendKICK` every 10 minutes and sends 1 KICK to all addresses that currently have < 0.15 KICK.
 */
export const batchSendKICKScheduler = async (): Promise<void> => {
    try {
        cron.schedule('*/10 * * * *', async () => {
            console.log('Running batchSendKICK...');
            await batchSendKICK();
        });
    } catch (err: any) {
        console.error('Error in batchSendKICKScheduler:', err.message);
    }
}