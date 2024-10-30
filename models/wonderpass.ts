import { AssetType } from './asset';

/**
 * Represents a Wonderpass instance; a battle pass system tailored to Wonderbits.
 */
export interface Wonderpass {
    /** the database ID of the Wonderpass */
    _id: string;
    /** 
     * the name of the wonderpass 
     * 
     * since we might not release only 1 wonderpass per season (or even have 1 for multiple seasons, having a name is more fitting)
     */
    name: string;
    /** the unix timestamp of when the wonderpass is valid from */
    start: number;
    /** the unix timestamp of when the wonderpass is valid until */
    end: number;
    /**
     * the level data of the wonderpass. includes the XP required to reach each level, the rewards for free and premium versions, etc.
     */
    levelData: WonderpassLevelData[];
}

/**
 * Represents the data for a specific level of a wonderpass.
 */
export interface WonderpassLevelData {
    /** the level of the wonderpass */
    level: number;
    /** the cumulative XP required to reach this level */
    xpRequired: number;
    /** the rewards for this level for the free version */
    freeRewards: WonderpassLevelReward[];
    /** the rewards for this level for the premium version */
    premiumRewards: WonderpassLevelReward[];
}

/**
 * Represents a reward for a specific level of a wonderpass.
 */
export interface WonderpassLevelReward {
    /** the type of reward */
    rewardType: AssetType | 'xCookies' | 'diamonds';
    /** the amount of the reward */
    amount: number;
}

/**
 * Represents the data for a user's progression on a Wonderpass.
 */
export interface UserWonderpassData {
    /** the database ID of this data instance */
    _id: string;
    /** the user's database ID */
    userId: string;
    /** the wonderpass ID */
    wonderpassId: string;
    /** the level the user is currently at */
    level: number;
    /** the amount of XP the user has */
    xp: number;
    /**
     * the levels where the user has pending free rewards to claim
     */
    claimableFreeLevels: number[];
    /**
     * the levels the user has claimed the free rewards for
     */
    claimedFreeLevels: number[];
    /**
     * the levels where the user has pending premium rewards to claim
     */
    claimablePremiumLevels: number[];
    /**
     * the levels the user has claimed the premium rewards for
     */
    claimedPremiumLevels: number[];
}