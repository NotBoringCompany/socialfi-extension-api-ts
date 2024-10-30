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
     * the rewards for each level of the wonderpass for free-to-play users (non-premium)
     */
    freeLevelRewards: WonderpassLevelRewardData[];
    /**
     * the rewards for each level of the wonderpass for premium users (i.e. users who purchase the premium version of the pass)
     */
    premiumLevelRewards: WonderpassLevelRewardData[];
}

/**
 * Represents the reward data for a specific level of a wonderpass.
 */
export interface WonderpassLevelRewardData {
    /** the level of the wonderpass */
    level: number;
    /** the rewards for the level */
    rewards: WonderpassLevelReward[];
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