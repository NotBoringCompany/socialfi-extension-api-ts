
import { resetPOIItemsData } from '../api/poi';

import Bull from 'bull';
import { POI_ITEM_DATA_RESET_TIME_RANGES } from '../utils/constants/poi';
import { adjustRandomTimeToNextDay, getRandomTimeBetween } from '../utils/time';
import { redis } from '../utils/constants/redis';

export const resetPOIItemsDataQueue = new Bull('resetPOIItemsDataQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Checks if a POI item data reset is already scheduled for the given time range.
 */
export const checkPOIItemDataResetAlreadyScheduled = async (timeRange: { start: number, end: number }): Promise<boolean> => {
    const scheduledTime = await redis.get('poiItemDataResetScheduledTime');
    if (!scheduledTime) {
        console.log(`(checkPOIItemDataResetAlreadyScheduled) scheduledTime for time range (${timeRange.start}-${timeRange.end}) is null/undefined`);
        return false
    };

    const now = new Date();
    const currentHour = now.getUTCHours();
    const nextScheduledTime = new Date(scheduledTime).getTime();

    // Determine the end time for today
    const todayEnd = new Date();
    todayEnd.setUTCHours(timeRange.end, 0, 0, 0);
    let targetEndTime = todayEnd.getTime();

    // If the current time is past the end of today's time range, schedule for tomorrow time range
    console.log(`(checkPOIItemDataResetAlreadyScheduled), currentHour(${currentHour}) >= timeRange.end(${timeRange.end}) equal ${currentHour >= timeRange.end}`);
    if (currentHour >= timeRange.end) {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); // Move to tomorrow
        tomorrow.setUTCHours(timeRange.end, 0, 0, 0);   // Set tomorrow's end time
        targetEndTime = tomorrow.getTime();
    }

    // return true if the next scheduled time falls within the future range
    console.log(`(checkPOIItemDataResetAlreadyScheduled) ${now.getTime()} < ${nextScheduledTime} && ${nextScheduledTime} < ${targetEndTime} is ${now.getTime() < nextScheduledTime && nextScheduledTime < targetEndTime}`)
    return now.getTime() < nextScheduledTime && nextScheduledTime < targetEndTime;
}

/**
 * 
 * Determines the next available time range to call `resetPOIItemsData` based on the current hour after the current time range has been scheduled and executed.
 */
export const getNextTimeRangeForPOIItemDataReset = (currentHour: number) => {
    return POI_ITEM_DATA_RESET_TIME_RANGES.find(range => currentHour < range.start);
}

/**
 * Schedules the next POI item data reset 
 * (to reset the `buyable` and `sellable` amounts for global items and to reset the `userTransactionData` for player items).
 */
export const scheduleNextPOIItemDataReset = async (): Promise<void> => {
    try {
        const now = new Date();
        const currentHour = now.getUTCHours();

        // get the next available time range after the current hour
        let nextRange = getNextTimeRangeForPOIItemDataReset(currentHour);

        // if no future range is found for today, move to the first time range for the next day
        if (!nextRange) {
            nextRange = POI_ITEM_DATA_RESET_TIME_RANGES[0];
            console.log(`(scheduleNextPOIItemDataReset) No next time range found. Using the first time range (${nextRange.start}-${nextRange.end}) for the next day.`);
        }

        // skip scheduling if the job is already scheduled for the current time range
        if (await checkPOIItemDataResetAlreadyScheduled(nextRange)) {
            console.log(`(scheduleNextPOIItemDataReset) POI item data reset already scheduled for range (${nextRange.start}-${nextRange.end}). Reset scheduled at ${await redis.get('poiItemDataResetScheduledTime')}`);
            return;
        }

        // generate a random time within the next time range
        let randomTime = getRandomTimeBetween(nextRange.start, nextRange.end);

        // if the time range is for tomorrow, adjust `randomTime` to reflect that
        if (nextRange.start < currentHour) {
            randomTime = adjustRandomTimeToNextDay(randomTime, now, nextRange.start);
        }

        const delay = randomTime.getTime() - now.getTime();
        console.log(`(scheduleNextPOIItemDataReset) Delay for next POI item data reset at ${randomTime.toISOString()}: ${delay}ms`);

        if (delay > 0) {
            console.log(`Scheduling next POI item data reset at ${randomTime.toISOString()}`);
            await redis.set('poiItemDataResetScheduledTime', randomTime.toISOString());
            await resetPOIItemsDataQueue.add({}, { delay });
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