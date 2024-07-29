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
    /** the latest milestone of the amount of referred users who reached level 5. used as benchmarking to check if new rewards should be given. */
    level5ReferredUsersLatestMilestone: number;
    /** the claimable referral rewards based on referred users */
    claimableReferralRewards: ReferralReward;
}

/**
 * Represents a user who was referred by another user.
 */
export interface ReferredUserData {
    /** the referred user's database id */
    userId: string;
    /** the referred user's username */
    username: string;
    /** when the user was referred */
    referredTimestamp: number;
    /** if the user has reached level 4 (requirement to receive referral rewards from this user) */
    hasReachedLevel4: boolean;
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

/**
 * Represents the data of a referrer who successfully referred a user who successfully referred one or more users.
 * 
 * For example, User A refers User B, and User B refers User C and User D. User C and D are indirect referrals of User A.
 * 
 * Once User C and D reaches level 4, User B gets rewards, while User A gets 25% of the rewards User B gets.
 * 
 * NOTE: In order for this to happen, User B must be level 4 first anyways.
 */
export interface SuccessfulIndirectReferral {
    /** the main referrer's user ID (i.e. User A) */
    userId: string;
    /** the indirect referral data for successful indirect referrals */
    indirectReferralData: IndirectReferralData[];
}

/**
 * Represents the data of an indirect referral.
 */
export interface IndirectReferralData {
    /** 
     * the user count milestone of the rewards that the main user (User A) has obtained for the indirect referrals (i.e. the referrals of User B). 
     * 
     * the milestones can be obtained in `GET_SEASON_0_REFERRAL_REWARDS`.
     * 
     * For example, if User A has indirectly earned the rewards for User B referring User C, D and E, then `obtainedRewardMilestone` will be 3 once the user has claimed the rewards.
     */
    obtainedRewardMilestone: number;
    /** 
     * the claimable indirect referral reward data based on the obtained reward milestone. 
     * 
     * for example, if the milestone is 3, then the user has already obtained the rewards for 3 indirect referrals. they will get the rewards for indirectly referring 3 users.
     * once claimed, `obtainedRewardMilestone` will be set to 3.
     */
    claimableRewardData: {
        // the milestone count for this reward data (e.g. 3 indirect referrals)
        userCountMilestone: number;
        xCookies: number;
        leaderboardPoints: number;

    };
    /** the referred user's user ID (i.e. User B's user ID) */
    referredUserId: string;
    /** the user IDs that User B referred to (e.g. User C, D, E...), which are indirect referrals to User A */
    indirectReferredUserIds: string[];
}