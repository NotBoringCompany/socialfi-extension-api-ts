import { depleteEnergyScheduler } from './bit';
import { updateClaimableXCookiesScheduler, updateGatheringProgressAndDropResourceScheduler } from './island';
import { updateClaimableSeaweedScheduler } from './raft';

export const schedulers = async (): Promise<void> => {
    try {
        // update gathering progress first because bits' energies will deplete afterwards
        await updateGatheringProgressAndDropResourceScheduler();
        await updateClaimableXCookiesScheduler();
        await updateClaimableSeaweedScheduler();
        await depleteEnergyScheduler();
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}