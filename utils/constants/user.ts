import { ReferralReward } from '../../models/invite';
import { POIName } from '../../models/poi';
import { BeginnerReward, BeginnerRewardType, DailyLoginReward, DailyLoginRewardType } from '../../models/user';

/** The maximum weight a user's inventory can be */
export const MAX_INVENTORY_WEIGHT = 500;

/** the last day to claim beginner rewards */
export const MAX_BEGINNER_REWARD_DAY = 7;

/** Maximum number of energy potions that can be stored */
export const MAX_ENERGY_CAP = 4000;

/** Maximum number of energy potions that can be stored */
export const MAX_ENERGY_POTION_CAP = 4;

/** Energy Potion recovery value when consumed */
export const ENERGY_POTION_RECOVERY = 250;

/** Base number of reroll milestone chance */
export const BASE_REROLL_BONUS_MILESTONE = 6;

/** Maximum number of Friends each user can have */
export const MAX_FRIENDS_CAP = 50;

/**
 * Gets the daily login rewards. Currently only supports xCookies and leaderboard points.
 * 
 * `currentConsecutiveDays` refers to the amount of days the user has claimed the daily rewards.
 * Since claiming now will be `currentConsecutiveDays` + 1 technically, the rewards obtained will be based on that.
 */
export const GET_DAILY_LOGIN_REWARDS = (
    currentConsecutiveDays: number
): DailyLoginReward[] => {
    // logic is as follows:
    // 1. the first day will give 50 leaderboard points.
    // 2. every day after that will give 50 + (12.5 * (currentConsecutiveDays - 1)) leaderboard points. e.g. day 1 will give 50, day 2 will give 62.5, day 3 will give 75, etc.
    // 3. max is 125 leaderboard points, obtained after the 7th day. every day after the 7th day means the user will get 125 leaderboard points.
    // 4. for now, xCookies will be 0.
    const points = 50 + (12.5 * currentConsecutiveDays);
    
    // logic for xCookies, starting from 2 ConsecutiveDays will gave xCookies and start increasing by 1 from 4 ConsecutiveDays
    const xCookies = 
    currentConsecutiveDays <= 1 ? 0 :
    currentConsecutiveDays <= 3 ? 1 :
    currentConsecutiveDays <= 4 ? 2 :
    currentConsecutiveDays <= 5 ? 3 :
    currentConsecutiveDays <= 6 ? 4 : 5;

    return [
        {
            type: DailyLoginRewardType.X_COOKIES,
            amount: xCookies
        },
        {
            type: DailyLoginRewardType.LEADERBOARD_POINTS,
            amount: points > 125 ? 125 : points
        }
    ];
}

/**
 * Gets the beginner rewards for a specific day.
 * 
 * `day` refers to the current day the user wants to the claim the rewards for.
 */
export const GET_BEGINNER_REWARDS = (day: number): BeginnerReward[] => {
    if (day > MAX_BEGINNER_REWARD_DAY) {
        // return an empty array if the user has passed the 7 day mark.
        return [];
    }

    // logic is as follows:
    // for xCookies: in the 1st day, users get 100 xCookies. 2nd-7th day, users get 25 xCookies.
    // for bit orbs: users get 1 bit orb on the 1st, 3rd, 5th and 7th day
    // for terra caps: users get 1 terra cap only on the first day
    if (day === 1) {
        return [
            {
                type: BeginnerRewardType.X_COOKIES,
                amount: 100
            },
            {
                type: BeginnerRewardType.BIT_ORB_I,
                amount: 1
            },
            {
                type: BeginnerRewardType.TERRA_CAPSULATOR_I,
                amount: 1
            }
        ];
    }

    if (day % 2 === 0) {
        return [
            {
                type: BeginnerRewardType.X_COOKIES,
                amount: 25
            }
        ];
    } else {
        return [
            {
                type: BeginnerRewardType.X_COOKIES,
                amount: 25
            },
            {
                type: BeginnerRewardType.BIT_ORB_I,
                amount: 1
            }
        ];
    }
}

/**
 * Gets Season 0's referral rewards.
 * 
 * The current referral system works where:
 * The more referred users the user has, the more rewards they can obtain once the referred users reach REFERRAL_REQUIRED_LEVEL.
 */
export const GET_SEASON_0_REFERRAL_REWARDS = (userCount: number): ReferralReward => {
    if (userCount === 1) {
        return {
            xCookies: 10,
            leaderboardPoints: 0
        }
    } else if (userCount > 1 && userCount <= 3) {
        return {
            xCookies: 45,
            leaderboardPoints: 0
        }
    } else if (userCount > 3 && userCount <= 5) {
        return {
            xCookies: 75,
            leaderboardPoints: 0
        }
    } else if (userCount > 5 && userCount <= 10) {
        return {
            xCookies: 150,
            leaderboardPoints: 0
        }
    } else if (userCount > 10 && userCount <= 20) {
        return {
            xCookies: 300,
            leaderboardPoints: 0
        }
    } else if (userCount > 20 && userCount <= 50) {
        return {
            xCookies: 750,
            leaderboardPoints: 0
        }
    } else if (userCount > 50 && userCount <= 100) {
        return {
            xCookies: 1500,
            leaderboardPoints: 0
        }
    } else {
        return {
            xCookies: 0,
            leaderboardPoints: 0
        }
    }
}

/**
 * Gets a user's player level based on the amount of points they have on the current season's leaderboard.
 */
export const GET_PLAYER_LEVEL = (points: number): number => {
    if (points < 0) return 0; // Handle negative points

    const levels = [
        { min: 0, max: 4, level: 1 },
        { min: 5, max: 24, level: 2 },
        { min: 25, max: 49, level: 3 },
        { min: 50, max: 99, level: 4 },
        { min: 100, max: 149, level: 5 },
        { min: 150, max: 249, level: 6 },
        { min: 250, max: 399, level: 7 },
        { min: 400, max: 599, level: 8 },
        { min: 600, max: 899, level: 9 },
        { min: 900, max: 1209, level: 10 },
    ]

    for (let i = 0; i < levels.length; i++) {
        if (points >= levels[i].min && points <= levels[i].max) {
            return levels[i].level;
        }
    }

    // for levels beyond 10, formula is P = 10 * L^2.
    return Math.floor(Math.sqrt(points / 10));
}

/**
 * Gets the rewards and potential unlocks for a player based on their level.
 * 
 * For example, if `maxPlayerEnergy`, this will be the new maxPlayerEnergy the user will have.
 */
export const GET_PLAYER_LEVEL_REWARDS_AND_UNLOCKS = (newLevel: number): {
    // increase in max player energy (cumulative) at this level
    maxPlayerEnergyIncrease: number;
    // the new base inventory weight cap at this level
    baseInventoryWeightCap: number;
    // how many diamonds the user earns for reaching this level
    diamonds: number;
} => {
    // starts at 500, increase of 50 per level until level 9; 1000 at level 10 and stagnant at 1000 after level 10
    const baseInventoryWeightCap = newLevel <= 9 ? MAX_INVENTORY_WEIGHT + (newLevel - 1) * 50 : newLevel === 10 ? 1000 : 1000;
    // INCREASE in max player energy
    const maxPlayerEnergyIncrease = newLevel >= 6 ? (newLevel - 4) * 5 : 0;
    // 3 diamonds for levels 2 to 9, 6 diamonds for level 10, else 0
    const diamonds = newLevel >= 2 && newLevel <= 9 ? 3 : newLevel === 10 ? 6 : 0;

    return {
        maxPlayerEnergyIncrease,
        baseInventoryWeightCap,
        diamonds
    };
}

/**
 * Returns the rewards for a weekly MVP that consumed/spent the most of a specific item.
 */
export const WEEKLY_MVP_REWARDS = (mvpType: 'xCookies' | 'Bit Orb' | 'Terra Capsulator'): {
    leaderboardPoints: number;
} => {
    switch (mvpType) {
        case 'xCookies':
            return {
                leaderboardPoints: 3000
            }
        case 'Bit Orb':
            return {
                leaderboardPoints: 1500
            }
        case 'Terra Capsulator':
            return {
                leaderboardPoints: 1500
            }
        default:
            return {
                leaderboardPoints: 0
            }
    }
}

/**
 * Return user daily reroll bonus milestone reward based on given tappingLevel
 */
export const DAILY_REROLL_BONUS_MILESTONE = (tappingLevel: number) => {
    return BASE_REROLL_BONUS_MILESTONE + (tappingLevel -1) * 1
};