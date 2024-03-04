import { depleteEnergyScheduler } from './bit';
import { updateGatheringProgressAndDropResourceScheduler } from './island';

export const schedulers = async (): Promise<void> => {
    try {
        // update gathering progress first because bits' energies will deplete afterwards
        await updateGatheringProgressAndDropResourceScheduler();
        await depleteEnergyScheduler();
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}