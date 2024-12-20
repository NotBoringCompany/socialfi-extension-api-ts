import { Asset, AssetType } from './asset';
import { CraftedAssetRarity } from './craft';
import { IslandType } from './island';
import { POIName } from './poi';
import { ResourceRarity } from './resource';

/**
 * Represents the upgrade data for upgradable assets.
 */
export interface UpgradableAssetData {
    /** the type of asset */
    asset: UpgradableAsset;
    /**
     * level-based upgrade requirements to upgrade an upgradable asset from one level to another.
     */
    upgradeRequirements: UpgradeRequirement[];
}

/**
 * Represents a list of upgradable assets that can be upgraded via the `universalAssetUpgrade` function.
 */
export enum UpgradableAsset {
    BIT = 'Bit',
    ISLAND = 'Island',
    RAFT = 'Raft',
    BERRY_FACTORY = 'Berry Factory'
}

/**
 * Represents the requirements (and costs) to upgrade to this particular level.
 */
export interface UpgradeRequirement {
    /** 
     * the level range this upgrade is valid for.
     * 
     * this is used if a range/set of levels have the same exact requirements.
     * 
     * for example, say upgrading asset A from level 2 to 9 requires 100 xCookies and 10 asset A.
     * we can use `levelRange` to set this instead of having to set the same requirements for each level from 2 to 9.
     * 
     * NOTE: if the requirements are only valid for a single level, `levelFloor` and `levelCeiling` can be set to the same value.
     */
    levelRange: UpgradeRequirementLevelRange | null;
    /**
     * used when the asset to upgrade is an island.
     * 
     * this is used to determine which island type is valid for this upgrade requirement.
     */
    islandType: IslandType | null;
    /**
     * used when the asset to upgrade is a berry factory.
     * 
     * this is used to determine which POI is valid for this upgrade requirement.
     */
    poi: POIName | null;
    /**
     * the upgrade costs to upgrade to this level.
     * 
     * NOTE: this is made an array to support multiple cost groups.
     * for instance, say asset A can be upgraded EITHER using:
     * 1. 100 xCookies and 10 asset X OR
     * 2. 150 xCookies and 5 asset Y.
     * 
     * cost group 1 will be placed in index 0, and cost group 2 will be placed in index 1.
     * then, the user can choose which cost group to use to upgrade the asset.
     * 
     * NOTE: only one cost group can be used to upgrade an asset.
     */
    upgradeCosts: UpgradeCost[];
}

/**
 * Represents the level range for upgrade requirements.
 */
export interface UpgradeRequirementLevelRange {
    /** the minimum level in the range */
    levelFloor: number;
    /** the maximum level in the range */
    levelCeiling: number;
}

/**
 * Represents the upgrade costs to upgrade an upgradable asset.
 */
export interface UpgradeCost {
    /** the amount of xCookies required to upgrade to `level` */
    xCookies: number | null;
    /** the assets required to upgrade to `level` */
    assetData: AssetUpgradeRequirement[] | null;
    /** the amount of totalExperience required to upgrade to `level` */
    totalExperience: number | null;
}

/**
 * Represents the requirement data when requiring assets to upgrade an upgradable asset.
 */
export interface AssetUpgradeRequirement {
    /** 
     * the asset category of the required asset.
     */
    assetCategory: 'resource' | 'food' | 'item';
    /**
     * the specific asset required.
     * 
     * having a specific `specificAsset` and having `specificAsset` as `any` is allowed.
     * 
     * for example, if `assetCategory` is `resource` and `specificAsset` is `any` and `requiredRarity` is `ResourceRarity.COMMON`,
     * the user can use any common resource to upgrade the upgradable asset.
     */
    specificAsset: AssetType | 'any';
    /**
     * The minimum rarity of the asset required.
     * 
     * Some assets have no rarity, so the value can be 'none'.
     */
    requiredRarity: CraftedAssetRarity | ResourceRarity | 'none';
    /**
     * The amount of the asset required.
     */
    amount: number;
}