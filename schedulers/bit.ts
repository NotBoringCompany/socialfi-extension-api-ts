import cron from 'node-cron';
import { depleteEnergy } from '../api/bit';
// import Bull from 'bull';

// export const depleteEnergyQueue = new Bull('depleteEnergyQueue', {
//     redis: process.env.REDIS_URL
// });

// /**
//  * Calls `depleteEnergy` every 15 minutes and depletes all bits' energies.
//  */
// depleteEnergyQueue.process(async () => {
//     console.log('Running depleteEnergyQueue...');
//     await depleteEnergy();
// });

// /**
//  * Calls `depleteEnergy` every 15 minutes and depletes all bits' energies.
//  */
// export const depleteEnergyScheduler = async (): Promise<void> => {
//     try {
//         cron.schedule('*/15 * * * *', async () => {
//             console.log('Running depleteEnergyScheduler...');
//             await depleteEnergy();
//         });
//     } catch (err: any) {
//         console.error('Error in depleteEnergyScheduler:', err.message);
//     }
// }