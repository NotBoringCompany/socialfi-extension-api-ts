import cron from 'node-cron';
import { batchSendKICK } from '../api/web3';

import Bull from 'bull';

export const batchSendKICKQueue = new Bull('batchSendKICKQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Calls `batchSendKICK` every 5 minutes and sends 1 KICK to all addresses that currently have < 0.1 KICK.
 */
batchSendKICKQueue.process(async () => {
    console.log('Running batchSendKICK...');
    await batchSendKICK();
});

// /**
//  * Calls `batchSendKICK` every 5 minutes and sends 1 KICK to all addresses that currently have < 0.1 KICK.
//  */
// export const batchSendKICKScheduler = async (): Promise<void> => {
//     try {
//         cron.schedule('*/5 * * * *', async () => {
//             console.log('Running batchSendKICK...');
//             await batchSendKICK();
//         });
//     } catch (err: any) {
//         console.error('Error in batchSendKICKScheduler:', err.message);
//     }
// }