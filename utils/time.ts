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