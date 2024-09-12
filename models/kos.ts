import { BoosterItem } from './booster';
import { BitOrbType, TerraCapsulatorType } from './item';

/**
 * Represents the full metadata of a Key Of Salvation.
 */
export interface KOSMetadata {
    /** the token id of the key */
    keyId: number;
    /** the key name */
    name: string;
    /** the key's image URL */
    image: string;
    /** the key's animation URL */
    animationUrl: string;
    /** the key's attributes */
    attributes: KOSMetadataAttribute[];
}

export interface KOSMetadataAttribute {
    /** the display type of this attribute in nft marketplaces */
    displayType: string | null;
    /** the trait type */
    traitType: string;
    /** the value of this trait */
    value: number | string;
}

/**
 * Represents the explicit ownership struct of a Key Of Salvation.
 */
export interface KOSExplicitOwnership {
    /** the token id of the key */
    tokenId: number;
    /** the owner of the key */
    owner: string;
    /** the start timestamp of the ownership */
    startTimestamp: number;
    /** if the key is burned */
    burned: boolean;
    /** extra data */
    extraData: number;
}

/**
 * Represents all available pillar types for KOS.
 */
export enum KOSPillarTypes {
    PILLAR_OF_ETERNITY = 'Pillar of Eternity',
    PILLAR_OF_DESTINY = 'Pillar of Destiny',
}

/**
 * Represents all available podium types for KOS.
 */
export enum KOSPodiumTypes {
    TIMELESS_TRIUNE = 'Timeless Triune',
    PRIMORDIAL_PRISM = 'Primordial Prism',
    STELLAR_SELENITE = 'Stellar Selenite',
}

/**
 * Represents all available house types for KOS.
 */
export enum KOSHouseTypes {
    TRADITION = 'Tradition',
    CHAOS = 'Chaos',
    GLORY = 'Glory',
}

/**
 * Represents all available aura types for KOS.
 */
export enum KOSAuraTypes {
    SNOW = 'Snow',
    LIGHTNING = 'Lightning',
    SMOKE = 'Smoke',
}

/**
 * Represents the claimable daily rewards for any eligible user for KOS benefits.
 */
export interface KOSClaimableDailyReward {
    /** the user's database ID */
    userId: string;
    /** the user's username */
    username: string;
    /** the user's twitter profile picture URL */
    twitterProfilePicture: string;
    /** the claimable daily rewards the user can claim */
    claimableRewards: KOSReward[];
}

/**
 * Represents the claimable weekly rewards for any eligible user for KOS benefits.
 */
export interface KOSClaimableWeeklyReward {
    /** the user's database ID */
    userId: string;
    /** the user's username */
    username: string;
    /** the user's twitter profile picture URL */
    twitterProfilePicture: string;
    /** the claimable weekly rewards the user can claim */
    claimableRewards: KOSReward[];
}

/**
 * Represents a KOS reward instance.
 */
export interface KOSReward {
    /** the reward type */
    type: KOSRewardType;
    /** the amount of the reward to give */
    amount: number;
}

/**
 * Represents all available KOS reward types.
 */
export enum KOSRewardType {
    X_COOKIES = 'xCookies',
    GATHERING_PROGRESS_BOOSTER_25 = BoosterItem.GATHERING_PROGRESS_BOOSTER_25,
    GATHERING_PROGRESS_BOOSTER_50 = BoosterItem.GATHERING_PROGRESS_BOOSTER_50,
    GATHERING_PROGRESS_BOOSTER_100 = BoosterItem.GATHERING_PROGRESS_BOOSTER_100,
    LEADERBOARD_POINTS = 'Leaderboard Points',
    BIT_ORB_I = BitOrbType.BIT_ORB_I,
    BIT_ORB_II = BitOrbType.BIT_ORB_II,
    TERRA_CAPSULATOR_I = TerraCapsulatorType.TERRA_CAPSULATOR_I,
    TERRA_CAPSULATOR_II = TerraCapsulatorType.TERRA_CAPSULATOR_II,
    RAFT_SPEED_BOOSTER_60_MIN = BoosterItem.RAFT_SPEED_BOOSTER_60_MIN,
}