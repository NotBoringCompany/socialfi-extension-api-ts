import { Asset, AssetType } from './asset';

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
    BERRY_FACTORY = 'Berry Factory',
    BIT = 'Bit',
    ISLAND = 'Island',
}

/**
 * Represents the requirements to upgrade to this particular level.
 */
export interface UpgradeRequirement {
    /** 
     * the level this upgrade is valid for.
     * 
     * this is used if each level has different requirements.
     * 
     * NOTE: if both `level` and `levelRange` is somehow set, `levelRange` will take precedence.
     */
    level: number | null;
    /** 
     * the level range this upgrade is valid for.
     * 
     * this is used if a range/set of levels have the same exact requirements.
     * 
     * for example, say upgrading asset A from level 2 to 9 requires 100 xCookies and 10 asset A.
     * we can use `levelRange` to set this instead of having to set the same requirements for each level from 2 to 9.
     */
    levelRange: UpgradeRequirementLevelRange | null;
    /** the amount of xCookies required to upgrade to `level` */
    xCookies: number | null;
    /** the assets required to upgrade to `level` */
    assetData: AssetUpgradeRequirement[] | null;
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
 * Represents the requirement data when requiring assets to upgrade an upgradable asset.
 */
export interface AssetUpgradeRequirement {
    /** a generic asset */
    asset: AssetType;
    /** the type of asset */
    assetType: 'item' | 'resource' | 'food';
    /** the amount of the asset required */
    amount: number;
}