import { updateClaimableSeaweed } from '../api/raft';
import { depleteEnergyScheduler } from './bit';
import { updateClaimableXCookiesScheduler, updateGatheringProgressAndDropResourceScheduler } from './island';

export const schedulers = async (): Promise<void> => {
    try {
        // update gathering progress first because bits' energies will deplete afterwards
        await updateGatheringProgressAndDropResourceScheduler();
        await updateClaimableXCookiesScheduler();
        await updateClaimableSeaweed();
        await depleteEnergyScheduler();
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}