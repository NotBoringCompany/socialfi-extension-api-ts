import { depleteEnergyScheduler } from './bit';
import { removeOpenedTweetIdsTodayScheduler } from './chest';
import { checkArrivalScheduler } from './poi';
import { updateClaimableCrumbsScheduler, updateClaimableXCookiesScheduler, updateDailyBonusResourcesGatheredScheduler, updateGatheringProgressAndDropResourceScheduler } from './island';

export const schedulers = async (): Promise<void> => {
    try {
        // update gathering progress first because bits' energies will deplete afterwards
        await updateGatheringProgressAndDropResourceScheduler();
        await updateClaimableXCookiesScheduler();
        await updateClaimableCrumbsScheduler();
        await depleteEnergyScheduler();

        await removeOpenedTweetIdsTodayScheduler();
        await checkArrivalScheduler();
        await updateDailyBonusResourcesGatheredScheduler();
    } catch (err: any) {
        console.error('Error in schedulers:', err.message);
    }
}