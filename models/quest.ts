/****************
 * QUEST-RELATED MODELS
 ****************/

import { BoosterItem } from './booster';
import { ResourceType } from './resource';

/**
 * Represents a Quest.
 */
export interface Quest {
    /** unique id to distinguish the quest, starts from 1 */
    questId: number;
    /** quest name */
    name: string;
    /** quest description */
    description: string;
    /** quest type */
    type: QuestType;
    /** 
     * the limit of the amount of times the user can complete this quest 
     * 
     * NOTE: this should only be > 1 if the quest is a DAILY or REFRESHABLE quest.
     */
    limit: number;
    /** quest category */
    category: QuestCategory;
    /** quest image URL */
    imageUrl: string;
    /** quest banner URL */
    bannerUrl?: string;
    /** start timestamp of the quest */
    start: number;
    /** end timestamp of the quest */
    end: number;
    /** quest rewards */
    rewards: QuestReward[];
    /** completed by (database user IDs and the amount of times they completed this quest.) */
    completedBy: Array<{
        twitterId: string;
        timesCompleted: number;
    }>
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
 * Represents the category of a Quest.
 */
export enum QuestCategory {
    /** social quest */
    SOCIAL = 'Social',
    /** game quest */
    GAME = 'Game',
    /** board quest */
    BOARD = 'Board',
}

/**
 * Represents a singular reward of a Quest.
 * 
 * NOTE: If `minReceived` and `maxReceived` is equal, the reward is fixed; otherwise, it will be randomized between those ranges.
 */
export interface QuestReward {
    /** the asset that represents the reward (such as xCookies, food, resources etc) */
    rewardType: QuestRewardType,
    /** minimum amount of the reward received */
    minReceived: number,
    /** maximum amount of the reward received */
    maxReceived: number,
}

/**
 * Represents the type of a Quest Reward.
 */
export enum QuestRewardType {
    X_COOKIES = 'xCookies',
    FOOD = 'Food',
    BIT = 'Bit',
    GATHERING_PROGRESS_BOOSTER_25 = BoosterItem.GATHERING_PROGRESS_BOOSTER_25
}

/**
 * Represents a single requirement of a Quest.
 */
export interface QuestRequirement {
    /** type of the quest requirement */
    type: QuestRequirementType;
    /** quest requirement description */
    description?: string;
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
    // requires the tweet ID
    COMPLETE_TUTORIAL = 'Complete Tutorial',
    // 'submits' resources to complete a resource quest
    RESOURCE_SUBMISSION = 'Resource Submission',
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
    /** completed tutorial id */
    tutorialId?: number;
    /** the resources required to submit */
    resources?: QuestRequirementResource[];
}

/**
 * Represents the resources required to complete a resource-related quest.
 */
export interface QuestRequirementResource {
    /** the resource type */
    resourceType: ResourceType;
    /** the amount of the resource required */
    amount: number;
}
