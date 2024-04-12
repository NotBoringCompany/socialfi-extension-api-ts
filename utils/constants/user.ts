import { DailyLoginReward, DailyLoginRewardType } from '../../models/user';

/** The maximum weight a user's inventory can be */
export const MAX_INVENTORY_WEIGHT = 200;

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
    // 1. every day apart from the 7th day (7, 14, 21, 28...) will give 50 leaderboard points.
    // 2. users that claim the reward on the 2nd day gets + 2 points, 3rd day + 4, 4th day + 6.5 and 5th day + 10.
    // 3. every 7th day, users get 60 leaderboard points (50 + 10 max bonus points from consecutive claims) + 5 xCookies.

    // every 7th day, users get 60 leaderboard points + 5 xCookies
    if (currentConsecutiveDays + 1 % 7 === 0) {
        return [
            {
                type: DailyLoginRewardType.X_COOKIES,
                amount: 5
            },
            {
                type: DailyLoginRewardType.LEADERBOARD_POINTS,
                amount: 60
            }
        ];
    } else {
        // give 50 + 2 bonus points
        if (currentConsecutiveDays + 1 === 2) {
            return [
                {
                    type: DailyLoginRewardType.LEADERBOARD_POINTS,
                    amount: 52
                }
            ];
        // give 50 + 4 bonus points
        } else if (currentConsecutiveDays + 1 === 3) {
            return [
                {
                    type: DailyLoginRewardType.LEADERBOARD_POINTS,
                    amount: 54
                }
            ];
        // give 50 + 6.5 bonus points
        } else if (currentConsecutiveDays + 1 === 4) {
            return [
                {
                    type: DailyLoginRewardType.LEADERBOARD_POINTS,
                    amount: 56.5
                }
            ];
        // for 5 or more consecutive days, give 50 + 10 bonus points
        } else if (currentConsecutiveDays + 1 >= 5) {
            return [
                {
                    type: DailyLoginRewardType.LEADERBOARD_POINTS,
                    amount: 60
                }
            ];
        } else {
            // give 50 points for the first day
            return [
                {
                    type: DailyLoginRewardType.LEADERBOARD_POINTS,
                    amount: 50
                }
            ];
        }
    }
}