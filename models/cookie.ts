
/**
 * Represents a deposit instance for depositing cookies into the game to earn xCookies.
 */
export interface CookieDeposit {
    /** the depositor, almost always will be the same as the user's database id */
    depositor: string;
    /** the deposit ID */
    depositId: number;
    /** the amount of cookies deposited */
    amount: number;
    /** the transaction hash of the deposit */
    transactionHash: string;
    /** the deposit timestamp (in unix) */
    timestamp: number;
}

/**
 * Represents a withdrawal instance for withdrawing xCookies from the game to earn cookies in the blockchain.
 */
export interface CookieWithdrawal {
    /** the withdrawer, almost always will be the same as the user's database id */
    withdrawer: string;
    /** the withdrawal ID */
    withdrawalId: number;
    /** the amount of xCookies withdrawn */
    amount: number;
    /** the transaction hash of the withdrawal */
    transactionHash: string;
    /** the withdrawal timestamp (in unix) */
    timestamp: number;
}