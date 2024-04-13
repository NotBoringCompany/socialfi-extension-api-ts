/**
 * Represents an invite code's data used to play the game.
 */
export interface InviteCodeData {
    /** will be added here if the user signed up with a starter code */
    starterCode: string | null,
    /** will be added here if the user either signed up with a referral code or added one later */
    referralCode: string | null,
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