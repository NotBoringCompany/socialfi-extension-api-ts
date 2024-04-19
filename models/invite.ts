/**
 * Represents an invite code's data used to play the game.
 */
export interface InviteCodeData {
    /** will be added here if the user signed up with a starter code */
    usedStarterCode: string | null,
    /** 
     * will be added here if the user either signed up with a referral code or added one later 
     */
    usedReferralCode: string | null,
    /** 
     * if a referral code is specified, the referrer will be added here.
     * 
     * this is the database ID of the user who referred the user to sign up
     */
    referrerId: string | null,
}

/**
 * Represents a starter code's data.
 */
export interface StarterCodeData {
    /** the code itself */
    code: string,
    /** 
     * the amount of uses the code can provide.
     * 
     * starter codes may have a limit or can be infinite.
     */
    maxUses: number | 'infinite',
    /** a list of user IDs who have used the code */
    usedBy: string[]
}

/**
 * Represents the user's referral data.
 */
export interface ReferralData {
    /** the user's personal referral code */
    referralCode: string;
    /** the data of the users who got referred by this user (i.e. the users who use this user's referral code to sign up) */
    referredUsersData: ReferredUserData[];
}

/**
 * Represents a user who was referred by another user.
 */
export interface ReferredUserData {
    /** the referred user's database id */
    userId: string;
    /** 
     * if the user has reached level 3 
     * 
     * run by a scheduler every day at 23:59 UTC to check
     */
    hasReachedLevel3: boolean;
}

/**
 * Represents a referral reward instance.
 */
export interface ReferralReward {
    /** the amount of xCookies the user gets */
    xCookies: number;
    /** the amount of leaderboard points the user gets */
    leaderboardPoints: number;
}