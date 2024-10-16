
import { resetPOIItemsData } from '../api/poi';

import Bull from 'bull';
import { POI_ITEM_DATA_RESET_TIME_RANGES } from '../utils/constants/poi';
import { getRandomTimeBetween } from '../utils/time';

export const resetPOIItemsDataQueue = new Bull('resetPOIItemsDataQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Schedules the next POI item data reset 
 * (to reset the `buyable` and `sellable` amounts for global items and to reset the `userTransactionData` for player items).
 */
export const scheduleNextPOIItemDataReset = async () => {
    const now = new Date();

    for (const range of POI_ITEM_DATA_RESET_TIME_RANGES) {
        const randomTime = getRandomTimeBetween(range.start, range.end);
        const delay = randomTime.getTime() - now.getTime();

        if (delay > 0) {
            console.log(`Scheduling next POI item data reset at ${randomTime.toISOString()}`);
            await resetPOIItemsDataQueue.add({}, { delay });
        }
    }
}

/**
 * Calls `resetPOIItemsData` at any time on the given time ranges to reset the buyable and sellable amount of global items
 * as well as the user transaction data of player items.
 */
resetPOIItemsDataQueue.process(async () => {
    console.log('Running resetPOIItemsData...');
    await resetPOIItemsData();

    // reschedule the next reset after the current one completes
    await scheduleNextPOIItemDataReset();
});