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
            xCookies: 5,
            assetData: null
        },
        {
            level: null,
            levelRange: {
                levelFloor: 10,
                levelCeiling: 19
            },
            xCookies: 15,
            assetData: null
        },
        {
            level: null,
            levelRange: {
                levelFloor: 20,
                levelCeiling: 29
            },
            xCookies: 45,
            assetData: null
        },
        {
            level: null,
            levelRange: {
                levelFloor: 30,
                levelCeiling: 39
            },
            xCookies: 135,
            assetData: null
        },
        {
            level: null,
            levelRange: {
                levelFloor: 40,
                levelCeiling: 49
            },
            xCookies: 405,
            assetData: null
        },
        {
            level: null,
            levelRange: {
                levelFloor: 50,
                levelCeiling: 59
            },
            xCookies: 1215,
            assetData: null
        },
        {
            level: null,
            levelRange: {
                levelFloor: 60,
                levelCeiling: 65
            },
            xCookies: 3645,
            assetData: null
        }
    ]
}