/****************
 * QUEST-RELATED MODELS
 ****************/

import { Bit } from './bit';
import { BitOrb } from './bitOrb';
import { Food } from './food';
import { Item } from './item';
import { Resource } from './resource';
import { TerraCapsulator } from './terraCapsulator';

/**
 * Represents a Quest.
 */
export interface Quest {
    /** unique id to distinguish the quest, starts from 1 */
    id: number;
    /** quest name */
    name: string;
    /** quest description */
    description: string;
    /** quest type */
    type: QuestType;
    /** quest image URL */
    imageUrl: string;
    /** start timestamp of the quest */
    start: number;
    /** end timestamp of the quest */
    end: number;
    /** quest rewards */
    rewards: QuestReward[];
    /** completed by (database user IDs) */
    completedBy: string[];
    /** requirements to complete the quest */
    requirements: QuestRequirement[];
}

/**
 * Represents the type of a Quest.
 */
export enum QuestType {
    /** daily quests will be reset everyday at 23:59 UTC. */
    DAILY = 'Daily',
    /** single means a one-time quest; can only be completed once */
    SINGLE = 'Single',
    /** refreshable means that the quest will be reset manually by admin and thus can be completed multiple times */
    REFRESHABLE = 'Refreshable',
}

/**
 * Represents a singular reward of a Quest.
 * 
 * NOTE: If `minReceived` and `maxReceived` is equal, the reward is fixed; otherwise, it will be randomized between those ranges.
 */
export interface QuestReward {
    /** if this reward consists of resource(s) */
    resource?: Resource,
    /** if this reward consists of item(s) */
    item?: Item,
    /** if this reward consists of food(s) */
    food?: Food,
    /** if this reward consists of bit(s) */
    bit?: Bit,
    /** if this reward consists of bit orb(s) */
    bitOrb?: BitOrb,
    /** if this reward consists of terra capsulator(s) */
    terraCapsulator?: TerraCapsulator,
    /** if this reward consists of cookies */
    xCookie?: number,
    /** minimum amount of the reward received */
    minReceived: number,
    /** maximum amount of the reward received */
    maxReceived: number,
}

/**
 * Represents a single requirement of a Quest.
 */
export interface QuestRequirement {
    /** type of the quest requirement */
    type: QuestRequirementType;
    /** parameters of the quest requirement (such as having to follow this user, retweet this post and so on) */
    parameters: QuestRequirementParameters;
}

/**
 * Represents the type of a Quest Requirement.
 */
export enum QuestRequirementType {
    FOLLOW_USER = 'Follow User',
    // requires the tweet ID
    LIKE_AND_RETWEET = 'Like and Retweet',
    // requires the tweet ID
    REPLY_WITH_TEXT = 'Reply with Text',
}

/**
 * Represents the parameters of a Quest Requirement.
 */
export interface QuestRequirementParameters {
    /** the username of the user to follow */
    twitterUsername?: string;
    /** the tweet ID of the tweet to like, retweet and/or reply on */
    tweetId?: string;
    /** requires to text 'wonderbits' and 16 characters at least (exact requirements may vary later) */
    requiredText?: string;
}
