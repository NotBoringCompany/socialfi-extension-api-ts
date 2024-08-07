import cron from 'node-cron';
import { batchSendKICK } from '../api/web3';

/**
 * Calls `batchSendKICK` every hour and sends 1 KICK to all addresses that currently have < 0.15 KICK.
 */
export const batchSendKICKScheduler = async (): Promise<void> => {
    try {
        // run every hour
        cron.schedule('0 * * * *', async () => {
            console.log('Running batchSendKICK...');
            await batchSendKICK();
        });
    } catch (err: any) {
        console.error('Error in batchSendKICKScheduler:', err.message);
    }
}