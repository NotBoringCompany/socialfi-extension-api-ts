/****************
 * QUEST-RELATED MODELS
 ****************/

import { BoosterItem } from './booster';
import { FoodType } from './food';
import { POIName } from './poi';
import { ResourceType } from './resource';
import { User } from './user';

/**
 * Represents a Quest.
 */
export interface Quest {
    _id?: string;
    /** unique id to distinguish the quest, starts from 1 */
    questId: number;
    /** quest name */
    name: string;
    /** quest description */
    description: string;
    /** quest type */
    type: QuestType;
    /** quest tier */
    tier: QuestTier | null;
    /** quest progression */
    progression: boolean;
    /**
     * Indicates whether the quest must be accepted in order to make progress.
     */
    acceptable: boolean;
    /** the status of the quest, the quest will be hidden when it set to false */
    status: boolean;
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
    /**
     * POI where the quest is available.
     * If set to null, the quest is available at all POIs.
     */
    poi: POIName[] | null;
    /** start timestamp of the quest */
    start?: number;
    /** end timestamp of the quest */
    end?: number;
    /** quest rewards */
    rewards: QuestReward[];
    /** completed by (database user IDs and the amount of times they completed this quest.) */
    completedBy: Array<{
        twitterId: string;
        timesCompleted: number;
    }>;
    /** requirements to complete the quest */
    requirements: QuestRequirement[];
    qualification: QuestQualification;
    qualifiedUsers: string[];
    unlockable: boolean;
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
    /** this type of quest will have its progression tracked. */
    PROGRESSION = 'Progression',
}

/**
 * Represents the tier of a Quest.
 */
export enum QuestTier {
    TUTORIAL = 'Tutorial',
    RESOURCE = 'Resource Gathering',
    BEGINNER = 'Beginner',
    INTERMEDIATE = 'Intermediate',
    ADVANCED = 'Advanced',
    EXPERT = 'Expert',
    MASTER = 'Master',
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
    /** berry factory quest */
    BERRY_FACTORY = 'Berry Factory',
}

/**
 * Represents a singular reward of a Quest.
 *
 * NOTE: If `minReceived` and `maxReceived` is equal, the reward is fixed; otherwise, it will be randomized between those ranges.
 */
export interface QuestReward {
    /** the asset that represents the reward (such as xCookies, food, resources etc) */
    rewardType: QuestRewardType;
    /** minimum amount of the reward received */
    minReceived: number;
    /** maximum amount of the reward received */
    maxReceived: number;
}

/**
 * Represents the type of a Quest Reward.
 */
export enum QuestRewardType {
    EXP = 'Exp',
    X_COOKIES = 'xCookies',
    BIT = 'Bit',
    GATHERING_PROGRESS_BOOSTER_25 = BoosterItem.GATHERING_PROGRESS_BOOSTER_25,
    BURGER = FoodType.BURGER,
    CANDY = FoodType.CANDY,
    CHOCOLATE = FoodType.CHOCOLATE,
    JUICE = FoodType.JUICE,
}

/**
 * Represents a single requirement of a Quest.
 */
export interface QuestRequirement {
    _id?: string;
    /** type of the quest requirement */
    type: QuestRequirementType;
    /** quest requirement description */
    description?: string;
    /** parameters of the quest requirement (such as having to follow this user, retweet this post and so on) */
    parameters: QuestRequirementParameters;
    /** this field only help for fetching the quest detail */
    progress?: QuestProgression;
}

/**
 * Represents the type of a Quest Requirement.
 */
export enum QuestRequirementType {
    FOLLOW_USER = 'Follow User',
    // invite another user through referral
    INVITE_USER = 'Invite User',
    // requires the tweet ID
    LIKE_AND_RETWEET = 'Like and Retweet',
    // requires the tweet ID
    REPLY_WITH_TEXT = 'Reply with Text',
    // requires the tweet ID
    COMPLETE_TUTORIAL = 'Complete Tutorial',
    // 'submits' resources to complete a resource quest
    RESOURCE_SUBMISSION = 'Resource Submission',
    // Connect discord into user account
    CONNECT_DISCORD = 'Connect Discord',
    // Purchase an orb
    PURCHASE_ORB = 'Purchase Orb',
    // Use an orb
    CONSUME_ORB = 'Consume Orb',
    // Place a bit
    PLACE_BIT = 'Place Bit',
    // Feed a bit
    FEED_BIT = 'Feed Bit',
    // Purchase a capsule
    PURCHASE_CAPSULE = 'Purchase Capsule',
    // Consume a capsule
    CONSUME_CAPSULE = 'Consume Capsule',
    // Travel to a Point of Interest
    TRAVEL_POI = 'Travel POI',
    // Sell a certain amount of resources
    SELL_RESOURCE_AMOUNT = 'Sell Resource Amount',
    // Collect Points from resources
    COLLECT_POINT_RESOURCE = 'Collect Point Resource',
    // Join a squad
    JOIN_SQUAD = 'Join Squad',
    // Collect resource
    COLLECT_RESOURCE = 'Collect Resource',
    LOGIN_STREAK = 'Login Streak',
    ISLAND_OWNED = 'Island Owned',
    USE_GATHERING_BOOSTER = 'Use Gathering Booster',
    USE_TRAVEL_BOOSTER = 'Use Travel Booster',
    HATCH_BIT = 'Hatch Bit',
    SUMMON_ISLAND = 'Summon Island',
    LEVEL_UP = 'Level Up',
    CRAFT_ITEM = 'Craft Item',
    PURCHASE_ITEM = 'Purchase Item',
    TAPPING_MILESTONE = 'Tapping Milestone',
    TRAVEL_COUNT = 'Travel Count',
    TRAVEL_TIME = 'Travel Time',
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
    /** universal property for type */
    type?: string;
    /** universal property for countable value */
    count?: number;
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

/**
 * Represents user's quest progression.
 */
export interface QuestProgression {
    _id?: string;
    questId: string;
    requirementId: string;
    userId: string;
    /** current progress of the quest */
    progress: number;
    /** the requirement of the quest */
    requirement: number;
}

/**
 * Represents user's quest qualification.
 */
export interface QuestQualification {
    questId?: string | number;
    level?: number;
}

/**
 * Represents a user's daily quest.
 */
export interface QuestDaily {
    _id?: string;
    /** Reference to the associated Quest model. */
    quest: Quest;
    /** The user to whom the daily quest is assigned. */
    user: User;
    /** Indicates whether the user has accepted the quest. */
    accepted: boolean;
    /** Indicates whether the user has claimed the quest reward. */
    claimed: boolean;
    /** The point of interest (POI) where the quest is available, or null if it's available anywhere. */
    poi: POIName | null;
    /** Timestamp of when the daily quest was created. */
    createdAt: number;
    /** Timestamp of when the daily quest was expired. */
    expiredAt: number;
    /** Timestamp of when the user accepted the quest. */
    acceptedAt?: number;
    /** Timestamp of when the user claimed the reward. */
    claimedAt?: number;
}
