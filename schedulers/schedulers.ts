import { depleteEnergyScheduler } from './bit';
import { updateGatheringProgressAndDropResourceScheduler } from './island';

export const schedulers = async (): Promise<void> => {
    try {
        // deplete energy scheduler needs to run first
        await depleteEnergyScheduler();
        await updateGatheringProgressAndDropResourceScheduler();
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}