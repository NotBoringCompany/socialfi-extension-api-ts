import { ReferralReward } from '../../models/invite';
import { BeginnerReward, BeginnerRewardType, DailyLoginReward, DailyLoginRewardType } from '../../models/user';

/** The maximum weight a user's inventory can be */
export const MAX_INVENTORY_WEIGHT = 50000;

/** the last day to claim beginner rewards */
export const MAX_BEGINNER_REWARD_DAY = 7;

/** Maximum number of energy potions that can be stored */
export const MAX_ENERGY_CAP = 1000;

/** Maximum number of energy potions that can be stored */
export const MAX_ENERGY_POTION_CAP = 4;

/** Base number of reroll milestone chance */
export const BASE_REROLL_BONUS_MILESTONE = 6;

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
    return [
        {
            type: DailyLoginRewardType.X_COOKIES,
            amount: 0
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
 * The more referred users the user has, the more rewards they can obtain once the referred users reach Level 4.
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
    } else if (userCount > 100 && userCount <= 200) {
        return {
            xCookies: 3000,
            leaderboardPoints: 0
        }
    } else if (userCount > 200 && userCount <= 300) {
        return {
            xCookies: 4500,
            leaderboardPoints: 0
        }
    } else if (userCount > 300 && userCount <= 500) {
        return {
            xCookies: 7500,
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
 * Gets a user's player level based on the amount of points they have on the Season 0 leaderboard.
 */
export const GET_SEASON_0_PLAYER_LEVEL = (points: number): number => {
    if (points < 0) return 0; // Handle negative points
    const levels = [
        { min: 0, max: 149, level: 1 },
        { min: 150, max: 499, level: 2 },
        { min: 500, max: 799, level: 3 },
        { min: 800, max: 1499, level: 4 },
        { min: 1500, max: 4499, level: 5 }
    ];
    
    for (let i = 0; i < levels.length; i++) {
        if (points >= levels[i].min && points <= levels[i].max) {
            return levels[i].level;
        }
    }

    // for levels beyond 5, use the formula P = 500 * (L/2)^2
    return Math.floor(Math.sqrt(points / 500) * 2);
}

/**
 * Gets the `additionalPoints` to give to the user for Season 0 based on their player level.
 * 
 * Will be given once the user reaches that level.
 */
export const GET_SEASON_0_PLAYER_LEVEL_REWARDS = (level: number): number => {
    const rewards = [0, 15, 50, 80, 150, 450, 612.5, 800, 1012.5, 1250];
    
    if (level >= 1 && level <= 10) {
        return rewards[level - 1];
    } else if (level > 10) {
        // level 11 onwards, rewards are fixed at 1500 points.
        return 1500;
    } else {
        return 0;
    }
};

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