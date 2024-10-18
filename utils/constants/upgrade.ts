import { IslandType } from '../../models/island';
import { UpgradableAsset, UpgradableAssetData } from '../../models/upgrade';

/**
 * Represents the upgrade (evolve) data for bits.
 */
export const BIT_UPGRADE_DATA: UpgradableAssetData = {
    asset: UpgradableAsset.BIT,
    upgradeRequirements: [
        {
            level: null,
            levelRange: {
                levelFloor: 2,
                levelCeiling: 9
            },
            islandType: null,
            upgradeCosts: [
                {
                    xCookies: 5,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 10,
                levelCeiling: 19
            },
            islandType: null,
            upgradeCosts: [
                {
                    xCookies: 15,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 20,
                levelCeiling: 29
            },
            islandType: null,
            upgradeCosts: [
                {
                    xCookies: 45,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 30,
                levelCeiling: 39
            },
            islandType: null,
            upgradeCosts: [
                {
                    xCookies: 135,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 40,
                levelCeiling: 49
            },
            islandType: null,
            upgradeCosts: [
                {
                    xCookies: 405,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 50,
                levelCeiling: 59
            },
            islandType: null,
            upgradeCosts: [
                {
                    xCookies: 1215,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 60,
                levelCeiling: 65
            },
            islandType: null,
            upgradeCosts: [
                {
                    xCookies: 3645,
                    assetData: null
                }
            ]
        }
    ]
}

/**
 * Represents the upgrade (evolve) data for islands.
 */
export const ISLAND_UPGRADE_DATA: UpgradableAssetData = {
    asset: UpgradableAsset.ISLAND,
    upgradeRequirements: [
        {
            level: null,
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20
            },
            islandType: IslandType.PRIMAL_ISLES,
            upgradeCosts: [
                {
                    xCookies: 10,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20
            },
            islandType: IslandType.VERDANT_ISLES,
            upgradeCosts: [
                {
                    xCookies: 20,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20
            },
            islandType: IslandType.EXOTIC_ISLES,
            upgradeCosts: [
                {
                    xCookies: 40,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20
            },
            islandType: IslandType.XTERIO_ISLES,
            upgradeCosts: [
                {
                    xCookies: 40,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20
            },
            islandType: IslandType.CRYSTAL_ISLES,
            upgradeCosts: [
                {
                    xCookies: 70,
                    assetData: null
                }
            ]
        },
        {
            level: null,
            levelRange: {
                levelFloor: 2,
                levelCeiling: 20
            },
            islandType: IslandType.CELESTIAL_ISLES,
            upgradeCosts: [
                {
                    xCookies: 100,
                    assetData: null
                }
            ]
        },
    ]
}