import { ReferralReward } from '../../models/invite';
import { BeginnerReward, BeginnerRewardType, DailyLoginReward, DailyLoginRewardType } from '../../models/user';

/** The maximum weight a user's inventory can be */
export const MAX_INVENTORY_WEIGHT = 50000;

/** the last day to claim beginner rewards */
export const MAX_BEGINNER_REWARD_DAY = 7;

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
 * The more referred users the user has, the more rewards they can obtain once the referred users reach Level 3.
 */
export const GET_SEASON_0_REFERRAL_REWARDS = (userCount: number): ReferralReward => {
    if (userCount === 1) {
        return {
            xCookies: 10,
            leaderboardPoints: 0
        }
    } else if (userCount === 3) {
        return {
            xCookies: 45,
            leaderboardPoints: 0
        }
    } else if (userCount === 5) {
        return {
            xCookies: 75,
            leaderboardPoints: 0
        }
    } else if (userCount === 10) {
        return {
            xCookies: 150,
            leaderboardPoints: 0
        }
    } else if (userCount === 20) {
        return {
            xCookies: 300,
            leaderboardPoints: 0
        }
    } else if (userCount === 50) {
        return {
            xCookies: 750,
            leaderboardPoints: 0
        }
    } else if (userCount === 100) {
        return {
            xCookies: 1500,
            leaderboardPoints: 0
        }
    } else if (userCount === 200) {
        return {
            xCookies: 3000,
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
    if (points >= 0 && points <= 499) {
        return 1;
    } else if (points >= 500 && points <= 999) {
        return 2;
    } else if (points >= 1000 && points <= 2499) {
        return 3;
    } else if (points >= 2500 && points <= 4499) {
        return 4;
    } else if (points >= 4500 && points <= 6999) {
        return 5;
    } else if (points >= 7000 && points <= 9999) {
        return 6;
    } else if (points >= 10000 && points <= 13499) {
        return 7;
    } else if (points >= 13500 && points <= 17499) {
        return 8;
    } else if (points >= 17500 && points <= 21999) {
        return 9;
    } else {
        // for every 5000 points obtained after 22000, the player level increases by 1
        return Math.floor((points - 22000) / 5000) + 10;
    }
}

/**
 * Gets the `additionalPoints` to give to the user for Season 0 based on their player level.
 * 
 * Will be given once the user reaches that level.
 */
export const GET_SEASON_0_PLAYER_LEVEL_REWARDS = (level: number): number => {
    switch (level) {
        case 1:
            return 0;
        case 2:
            return 100;
        case 3:
            return 250;
        case 4:
            return 450;
        case 5:
            return 700;
        case 6:
            return 1000;
        case 7:
            return 1350;
        case 8:
            return 1750;
        case 9:
            return 2200;
        case 10:
            return 2700;
        default:
            // For level 10 or above it'll receive 500 additional points
            if (level > 10)
                return 2700 + (500 * (level - 10));
            // For any other value of `level`, including 0, NaN, and invalid levels, it returns 0 additional points
            else
                return 0;
    }
}