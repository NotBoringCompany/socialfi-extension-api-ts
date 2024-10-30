import { FoodType } from '../../models/food';
import { BerryFactoryMastery, BerryFactoryMasteryStats } from '../../models/mastery';
import { POIName } from '../../models/poi';
import { QuestType } from '../../models/quest';
import { PlayerMastery } from '../../models/user';
import { dayjs } from '../dayjs';
import { toCamelCase } from '../strings';

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
    const current = dayjs().utc().unix();
    const difference = current - DAILY_QUEST_INIT_LAPSE;

    const divide = difference / DAILY_QUEST_LAPSE_TIME;

    return [
        DAILY_QUEST_INIT_LAPSE + DAILY_QUEST_LAPSE_TIME * Math.floor(divide),
        DAILY_QUEST_INIT_LAPSE + DAILY_QUEST_LAPSE_TIME * Math.ceil(divide),
    ];
};

/**
 * Return Extra quest benefit that user can accept per 48 Hours
 */
export const EXTRA_QUESTS_BENEFIT = (mastery: PlayerMastery) => {
    // Initialize totalExtra count
    let totalExtra: number = 0;
    // Destructure data from berryFactory
    const evergreenVillage = mastery?.berryFactory?.[toCamelCase(POIName.EVERGREEN_VILLAGE) as keyof BerryFactoryMastery];
    const palmshadeVillage = mastery?.berryFactory?.[toCamelCase(POIName.PALMSHADE_VILLAGE) as keyof BerryFactoryMastery];
    const seabreezeHarbor = mastery?.berryFactory?.[toCamelCase(POIName.SEABREEZE_HARBOR) as keyof BerryFactoryMastery];

    // handle case for evergreenVillage
    if (evergreenVillage) {
        const { level } = evergreenVillage;
        if (level < 10) totalExtra += 0;
        else if (level < 20) totalExtra += 1;
        else totalExtra += 2;
    }

    // handle case for palmshadeVillage
    if (palmshadeVillage) {
        const { level } = palmshadeVillage;
        if (level < 10) totalExtra += 0;
        else if (level < 20) totalExtra += 1;
        else totalExtra += 2;
    }

    // handle case for seabreezeHarbor
    if (seabreezeHarbor) {
        const { level } = seabreezeHarbor;
        if (level < 10) totalExtra += 0;
        else if (level < 20) totalExtra += 1;
        else totalExtra += 2;
    }

    return totalExtra;
};

/**
 * Return Extra earning benefits based on Level, POIName, and Quest Type passed.
 * Extra Benefit will only apply if the Quest Type is DAILY and affects the respective POI only.
 */
export const EXTRA_LOCAL_EARNING_BENEFIT = (questType: QuestType, mastery: PlayerMastery, poiName: POIName): number => {
    // Only calculate benefits if the quest type is DAILY; otherwise, return 0
    if (questType !== QuestType.DAILY) return 0;

    // Retrieve level with fallback to 1 if undefined
    const level = mastery?.berryFactory?.[toCamelCase(poiName) as keyof BerryFactoryMastery]?.level ?? 1;

    // Determine extra benefit based on POIName and level
    switch(poiName) {
        case POIName.EVERGREEN_VILLAGE: {
            if (level < 5) return 0;
            else return 1;
        }
        case POIName.PALMSHADE_VILLAGE: {
            if (level < 5) return 0;
            else return 2;
        }
        case POIName.SEABREEZE_HARBOR: {
            if (level < 5) return 0;
            else return 3;
        }
        // For POI that isn't specified or invalid will return 0 as Benefit
        default: return 0;
    }
};

/**
 * Return Daily Quest Level Up Rewards
 */
export const DAILY_QUEST_LEVEL_UP_REWARDS = ( level: number, poiName: POIName ): { xCookies: number, cheques: number } => {
    switch(poiName) {
        case POIName.EVERGREEN_VILLAGE: {
            if (level >= 2 && level <= 4) {
                return { xCookies: 5, cheques: 10 };
            } else if (level === 5) {
                return { xCookies: 20, cheques: 20 };
            } else if (level >= 6 && level <= 9) {
                return { xCookies: 10, cheques: 10 };
            } else if (level === 10) {
                return { xCookies: 30, cheques: 30 };
            } else if (level >= 11 && level <= 19) {
                return { xCookies: 15, cheques: 10 };
            } else if (level === 20) {
                return { xCookies: 40, cheques: 30 };
            } else {
                return { xCookies: 0, cheques: 0 };
            }
        }
        case POIName.PALMSHADE_VILLAGE: {
            if (level >= 2 && level <= 4) {
                return { xCookies: 10, cheques: 50 };
            } else if (level === 5) {
                return { xCookies: 30, cheques: 100 };
            } else if (level >= 6 && level <= 9) {
                return { xCookies: 15, cheques: 50 };
            } else if (level === 10) {
                return { xCookies: 40, cheques: 150 };
            } else if (level >= 11 && level <= 19) {
                return { xCookies: 20, cheques: 50 };
            } else if (level === 20) {
                return { xCookies: 50, cheques: 150 };
            } else {
                return { xCookies: 0, cheques: 0 };
            }
        }
        case POIName.SEABREEZE_HARBOR: {
            if (level >= 2 && level <= 4) {
                return { xCookies: 20, cheques: 200 };
            } else if (level === 5) {
                return { xCookies: 40, cheques: 400 };
            } else if (level >= 6 && level <= 9) {
                return { xCookies: 20, cheques: 200 };
            } else if (level === 10) {
                return { xCookies: 50, cheques: 600 };
            } else if (level >= 11 && level <= 19) {
                return { xCookies: 25, cheques: 200 };
            } else if (level === 20) {
                return { xCookies: 60, cheques: 600 };
            } else {
                return { xCookies: 0, cheques: 0 };
            }
        }
        default: return { xCookies: 0, cheques: 0 };
    }
};