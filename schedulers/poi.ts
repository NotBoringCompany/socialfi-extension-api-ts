
import { resetPOIItemsData } from '../api/poi';

import Bull from 'bull';
import { POI_ITEM_DATA_RESET_TIME_RANGES } from '../utils/constants/poi';
import { getRandomTimeBetween } from '../utils/time';
import { redis } from '../utils/constants/redis';

export const resetPOIItemsDataQueue = new Bull('resetPOIItemsDataQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Checks if a POI item data reset is already scheduled for the given time range.
 */
export const checkPOIItemDataResetAlreadyScheduled = async (timeRange: { start: number, end: number }): Promise<boolean> => {
    const scheduledTime = await redis.get('poiItemDataResetScheduledTime');
    if (!scheduledTime) return false;

    const now = new Date().getTime();
    const nextScheduledTime = new Date(scheduledTime).getTime();

    // return true if the next scheduled time falls within the future range
    return now < nextScheduledTime && nextScheduledTime < new Date().setUTCHours(timeRange.end, 0, 0, 0);
}

/**
 * Schedules the next POI item data reset 
 * (to reset the `buyable` and `sellable` amounts for global items and to reset the `userTransactionData` for player items).
 */
export const scheduleNextPOIItemDataReset = async (): Promise<void> => {
    try {
        const now = new Date();

        for (const range of POI_ITEM_DATA_RESET_TIME_RANGES) {
            // skip the range if it is in the past
            const endTime = new Date();
            endTime.setUTCHours(range.end, 0, 0, 0);

            if (now > endTime) {
                console.log(`(scheduleNextPOIItemDataReset) Skipping POI item data reset scheduling for range (${range.start}-${range.end}) as it is in the past.`);
                continue;
            }

            // check if job is already scheduled for the given time range
            if (await checkPOIItemDataResetAlreadyScheduled(range)) {
                console.log(`(scheduleNextPOIItemDataReset) POI item data reset already scheduled for range (${range.start}-${range.end}).`);
                continue;
            }

            // generate a random time between the given range
            const randomTime = getRandomTimeBetween(range.start, range.end);
            const delay = randomTime.getTime() - now.getTime();

            console.log(`(scheduleNextPOIItemDataReset) Delay for next POI item data reset at ${randomTime.toISOString()}: ${delay}ms`);

            if (delay > 0) {
                console.log(`Scheduling next POI item data reset at ${randomTime.toISOString()}`);
                await redis.set('poiItemDataResetScheduledTime', randomTime.toISOString());
                await resetPOIItemsDataQueue.add({}, { delay });
            }
        }
    } catch (err: any) {
        console.error('Error in scheduleNextPOIItemDataReset:', err.message);
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