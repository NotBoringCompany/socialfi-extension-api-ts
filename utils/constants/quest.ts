import { FoodType } from '../../models/food';
import { dayjs } from '../dayjs';

/** gets the corresponding food from completing a quest based on the probability of obtaining it, depending on `rand`, which is a number from 1 to 100 */
export const RANDOMIZE_FOOD_FROM_QUEST = (): FoodType => {
    const rand = Math.floor(Math.random() * 100) + 1;

    switch (true) {
        case rand < 46:
            return FoodType.CANDY; // 45% chance
        case rand < 76:
            return FoodType.CHOCOLATE; // 30% chance
        case rand < 91:
            return FoodType.JUICE; // 15% chance
        default:
            return FoodType.BURGER; // 10% chance
    }
};

/**
 * Initial timestamp representing the lapse start time for daily quests.
 */
export const DAILY_QUEST_INIT_LAPSE = 1704038400; // January 1st 2024, 00:00 EST

/**
 * Time in seconds before a daily quest resets.
 */
export const DAILY_QUEST_LAPSE_TIME = 2 * 24 * 60 * 60; // 48 hours or 2 days

/**
 * Maximum number of daily quests that a user can accept and claim.
 * This limit ensures users don't take on too many quests at once.
 */
export const MAX_DAILY_QUEST_ACCEPTABLE = 6;

/**
 * Number of daily quests displayed per Point of Interest (POI).
 * This limits how many quests are shown at each location.
 */
export const DAILY_QUEST_PER_POI = 3;

/**
 * Calculates the current lapse phase for daily quests based on the current time.
 * It returns the start and end timestamps for the current phase.
 *
 * @returns [startLapse, endLapse] - The start and end of the current lapse phase.
 */
export const DAILY_QUEST_LAPSE_PHASE = () => {
    const current = dayjs().tz('America/New_York').unix();
    const difference = current - DAILY_QUEST_INIT_LAPSE;

    const divide = difference / DAILY_QUEST_LAPSE_TIME;

    return [
        DAILY_QUEST_INIT_LAPSE + DAILY_QUEST_LAPSE_TIME * Math.floor(divide),
        DAILY_QUEST_INIT_LAPSE + DAILY_QUEST_LAPSE_TIME * Math.ceil(divide),
    ];
};
