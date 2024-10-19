import { IslandType } from '../../models/island';
import { POIName } from '../../models/poi';
import { UpgradableAsset, UpgradableAssetData } from '../../models/upgrade';

/**
 * Represents the upgrade (evolve) data for bits.
 */
export const BIT_UPGRADE_DATA: UpgradableAssetData = {
    asset: UpgradableAsset.BIT,
    upgradeRequirements: [
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 9,
            },
            islandType: null,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 5,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 10,
                levelCeiling: 19,
            },
            islandType: null,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 15,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 20,
                levelCeiling: 29,
            },
            islandType: null,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 45,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 30,
                levelCeiling: 39,
            },
            islandType: null,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 135,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 40,
                levelCeiling: 49,
            },
            islandType: null,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 405,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 50,
                levelCeiling: 59,
            },
            islandType: null,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 1215,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 60,
                levelCeiling: 65,
            },
            islandType: null,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 3645,
                    assetData: null,
                },
            ],
        },
    ],
};

/**
 * Represents the upgrade (evolve) data for islands.
 */
export const ISLAND_UPGRADE_DATA: UpgradableAssetData = {
    asset: UpgradableAsset.ISLAND,
    upgradeRequirements: [
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20,
            },
            islandType: IslandType.PRIMAL_ISLES,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 10,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20,
            },
            islandType: IslandType.VERDANT_ISLES,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 20,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20,
            },
            islandType: IslandType.EXOTIC_ISLES,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 40,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20,
            },
            islandType: IslandType.XTERIO_ISLES,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 40,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20,
            },
            islandType: IslandType.CRYSTAL_ISLES,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 70,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20,
            },
            islandType: IslandType.CELESTIAL_ISLES,
            poi: null,
            upgradeCosts: [
                {
                    xCookies: 100,
                    assetData: null,
                },
            ],
        },
    ],
};

/**
 * Represents the upgrade (evolve) data for berry factories.
 */
export const BERRY_FACTORY_UPGRADE_DATA: UpgradableAssetData = {
    asset: UpgradableAsset.BERRY_FACTORY,
    upgradeRequirements: [
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 10,
            },
            islandType: null,
            poi: POIName.EVERGREEN_VILLAGE,
            upgradeCosts: [
                {
                    xCookies: 25,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 10,
            },
            islandType: null,
            poi: POIName.PALMSHADE_VILLAGE,
            upgradeCosts: [
                {
                    xCookies: 50,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 10,
            },
            islandType: null,
            poi: POIName.SEABREEZE_HARBOR,
            upgradeCosts: [
                {
                    xCookies: 100,
                    assetData: null,
                },
            ],
        },
        {
            levelRange: {
                levelFloor: 2,
                levelCeiling: 10,
            },
            islandType: null,
            poi: POIName.STARFALL_SANCTUARY,
            upgradeCosts: [
                {
                    xCookies: 200,
                    assetData: null,
                },
            ],
        },
    ],
};

/**
 * Represents the upgrade (evolve) data for rafts.
 * 
 * NOTE: This requires an `levelToUpgradeTo` parameter because the cost is dynamic per level.
 */
export const RAFT_UPGRADE_DATA = (levelToUpgradeTo: number): UpgradableAssetData => {
    return {
        asset: UpgradableAsset.RAFT,
        upgradeRequirements: [
            {
                levelRange: {
                    levelFloor: 2,
                    // technically no level ceiling, but we'll set it to a high number.
                    levelCeiling: 10000000,
                },
                islandType: null,
                poi: null,
                upgradeCosts: [
                    {
                        // starts at 100 xCookies when upgrading to level 2 and increases by 50 xCookies per level.
                        xCookies: 100 + (50 * (levelToUpgradeTo - 1)),
                        assetData: null,
                    },
                ],
            }
        ],
    }
}