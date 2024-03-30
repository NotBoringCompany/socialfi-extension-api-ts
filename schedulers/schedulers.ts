import { depleteEnergyScheduler } from './bit';
import { removeOpenedTweetIdsTodayScheduler } from './chest';
import { checkArrivalScheduler } from './city';
import { updateClaimableCrumbsScheduler, updateClaimableXCookiesScheduler, updateGatheringProgressAndDropResourceScheduler } from './island';

export const schedulers = async (): Promise<void> => {
    try {
        // update gathering progress first because bits' energies will deplete afterwards
        await updateGatheringProgressAndDropResourceScheduler();
        await updateClaimableXCookiesScheduler();
        await updateClaimableCrumbsScheduler();
        await depleteEnergyScheduler();

        await removeOpenedTweetIdsTodayScheduler();
        await checkArrivalScheduler();
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}