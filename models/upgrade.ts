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
    /** the level to upgrade to */
    level: number;
    /** the amount of xCookies required to upgrade to `level` */
    xCookies: number;
    /** the assets required to upgrade to `level` */
    assetData: AssetUpgradeRequirement[];
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