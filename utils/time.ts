/**
 * Generates a random time between two given hours in 24 hour format.
 */
export const getRandomTimeBetween = (startHour: number, endHour: number): Date => {
    const startDate = new Date();
    startDate.setUTCHours(startHour, 0, 0, 0);

    const endDate = new Date();
    endDate.setUTCHours(endHour, 0, 0, 0);

    const randomTime = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
    return randomTime;
}

/**
 * Updates `randomTime` to the next day if it is earlier than `now`.
 */
export const adjustRandomTimeToNextDay = (randomTime: Date, now: Date, timeRangeStartHour: number): Date => {
    if (randomTime <= now) {
        const adjustedTime = new Date(randomTime);
        adjustedTime.setDate(adjustedTime.getDate() + 1);

        return adjustedTime;
    }

    return randomTime;
} 