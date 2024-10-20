import { eventarc } from 'googleapis/build/src/apis/eventarc';
import { BitRarity } from '../models/bit';
import { Food } from '../models/food';
import { Item } from '../models/item';
import { BerryFactoryMastery } from '../models/mastery';
import { POIName } from '../models/poi';
import { ExtendedResource } from '../models/resource';
import { UpgradableAsset, UpgradeCost } from '../models/upgrade';
import { PlayerMastery } from '../models/user';
import { MAX_BIT_LEVEL } from '../utils/constants/bit';
import { BitModel, IslandModel, RaftModel, UserModel } from '../utils/constants/db';
import { MAX_ISLAND_LEVEL } from '../utils/constants/island';
import { BERRY_FACTORY_UPGRADE_DATA, BIT_UPGRADE_DATA, ISLAND_UPGRADE_DATA, RAFT_UPGRADE_DATA } from '../utils/constants/upgrade';
import { ReturnValue, Status } from '../utils/retVal';
import { toCamelCase } from '../utils/strings';

/**
 * Universal upgrade function for upgradable assets.
 * 
 * Use this to evolve bits and islands, as well as upgrade berry factories, for example.
 */
export const universalAssetUpgrade = async (
    twitterId: string, 
    asset: UpgradableAsset,
    /**
     * if the asset to upgrade has one or more cost groups, this is used to determine which cost group to use.
     * 
     * NOTE: this is an index, so it starts at 0.
     */
    upgradeCostGroup?: number,
    /**
     * required when upgrading either a bit or an island.
     */
    islandOrBitId?: number,
    /**
     * required when upgrading a berry factory.
     */
    poi?: POIName
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(universalAssetUpgrade) User not found.`,
            };
        }

        if (!asset) {
            return {
                status: Status.ERROR,
                message: `(universalAssetUpgrade) Asset to upgrade not inputted.`,
            };
        }

        const userUpdateOperations = {
            $set: {},
            $push: {},
            $pull: {},
            $inc: {},
        }

        const bitUpdateOperations = {
            $set: {},
            $push: {},
            $pull: {},
            $inc: {},
        };

        const islandUpdateOperations = {
            $set: {},
            $push: {},
            $pull: {},
            $inc: {},
        }

        const raftUpdateOperations = {
            $set: {},
            $push: {},
            $pull: {},
            $inc: {},
        }

        // if no upgrade cost group is inputted (e.g. because there is only one cost group), default to 0.
        let finalizedCostGroup: number = upgradeCostGroup ?? 0;
        let upgradeCosts: UpgradeCost[] = [];
        let levelToUpgradeTo = 0;

        // check which asset to upgrade.
        if (asset === UpgradableAsset.BIT) {
            // check if `islandOrBitId` is inputted.
            if (!islandOrBitId) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Bit ID not inputted.`,
                };
            }

            // check if the user owns the bit.
            if (!user.inventory?.bitIds || !(user.inventory?.bitIds as number[]).includes(islandOrBitId)) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Bit not found in user's inventory.`,
                };
            }

            const bit = await BitModel.findOne({ bitId: islandOrBitId }).lean();

            if (!bit) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Bit not found in the database.`,
                };
            }

            // bit needs to be placed in an island to start evolving.
            if (bit.placedIslandId === 0) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Bit is not placed in an island.`,
                }
            }

            // check if bit is already at max level
            if (bit.currentFarmingLevel >= MAX_BIT_LEVEL(<BitRarity>bit.rarity)) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Bit is already at max level.`,
                };
            }

            levelToUpgradeTo = bit.currentFarmingLevel + 1;

            // check the costs to upgrade.
            // find the `levelRange` where `levelToUpgradeTo` is between `levelFloor` and `levelCeiling` (inclusive).
            upgradeCosts = BIT_UPGRADE_DATA.upgradeRequirements.find(requirement => {
                return requirement.levelRange.levelFloor <= levelToUpgradeTo && requirement.levelRange.levelCeiling >= levelToUpgradeTo;
            })?.upgradeCosts ?? null;

            // if all checks pass, increase the bit's current farming level by 1.
            // NOTE: we do this prematurely, but this won't get called until the end of the function, meaning that if an error occurs, the bit's level won't be increased.
            bitUpdateOperations.$inc['currentFarmingLevel'] = 1;
        // if the asset to upgrade is an island
        } else if (asset === UpgradableAsset.ISLAND) {
            if (!islandOrBitId) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Island ID not inputted.`,
                };
            }

            // check if the user owns the island.
            if (!user.inventory?.islandIds || !(user.inventory?.islandIds as number[]).includes(islandOrBitId)) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Island not found in user's inventory.`,
                };
            }

            const island = await IslandModel.findOne({ islandId: islandOrBitId }).lean();

            if (!island) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Island not found in the database.`,
                };
            }

            // check if the island is already at max level. if it is, return an error.
            if (island.currentLevel >= MAX_ISLAND_LEVEL) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Island is already at max level.`,
                };
            }

            levelToUpgradeTo = island.currentLevel + 1;

            // check the costs to upgrade.
            // 1. find the `levelRange` where `levelToUpgradeTo` is between `levelFloor` and `levelCeiling` (inclusive).
            // 2. at the same time, find the `islandType` that matches the island's type.
            upgradeCosts = ISLAND_UPGRADE_DATA.upgradeRequirements.find(requirement => {
                return requirement.levelRange.levelFloor <= levelToUpgradeTo && 
                requirement.levelRange.levelCeiling >= levelToUpgradeTo && 
                requirement.islandType === island.type
            })?.upgradeCosts ?? null;

            // increase the island's current level by 1.
            // NOTE: we do this prematurely, but this won't get called until the end of the function, meaning that if an error occurs, the island's level won't be increased.
            islandUpdateOperations.$inc['currentLevel'] = 1;
        // if the asset to upgrade is a berry factory
        } else if (asset === UpgradableAsset.BERRY_FACTORY) {
            if (!poi) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) POI not inputted.`,
                };
            }

            // check if user is currently at this POI.
            if (user?.inGameData?.location !== poi) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) User is not currently at ${poi}.`,
                };
            }

            // fetch the user's mastery data for this particular POI's berry factory.
            // const berryFactoryMastery = (user?.inGameData?.mastery as PlayerMastery)?.berryFactory[toCamelCase(poi)];
            const berryFactoryData = user?.inGameData?.mastery?.berryFactory as BerryFactoryMastery;
            const berryFactoryMastery = berryFactoryData ? berryFactoryData[toCamelCase(poi)] : null;

            // if the mastery is empty, this means that the berry factory is still level 1. we just put `2` as the level to upgrade to.
            levelToUpgradeTo = berryFactoryMastery ? berryFactoryMastery.level + 1 : 2;

            // check the costs to upgrade.
            // 1. find the `levelRange` where `levelToUpgradeTo` is between `levelFloor` and `levelCeiling` (inclusive).
            // 2. at the same time, find the `poi` that matches the POI's name.
            upgradeCosts = BERRY_FACTORY_UPGRADE_DATA.upgradeRequirements.find(requirement => {
                return requirement.levelRange.levelFloor <= levelToUpgradeTo && 
                requirement.levelRange.levelCeiling >= levelToUpgradeTo && 
                requirement.poi === poi
            })?.upgradeCosts ?? null;

            // increase the berry factory's level by 1.
            // NOTE: we do this prematurely, but this won't get called until the end of the function, meaning that if an error occurs, the berry factory's level won't be increased.
            userUpdateOperations.$set[`inGameData.mastery.berryFactory.${toCamelCase(poi)}.level`] = levelToUpgradeTo;
        // if the asset to upgrade is a raft
        } else if (asset === UpgradableAsset.RAFT) {
            // check the user's raft ID
            // this shouldn't happen, but just in case.
            if (!user.inventory?.raftId) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Raft not found in user's inventory.`,
                };
            }

            // fetch the user's raft data.
            const raft = await RaftModel.findOne({ raftId: user.inventory.raftId }).lean();

            // if the raft is not found in the database, return an error.
            if (!raft) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Raft not found in the database.`,
                };
            }

            levelToUpgradeTo = raft.currentLevel + 1;

            // check the costs to upgrade.
            // find the `levelRange` where `levelToUpgradeTo` is between `levelFloor` and `levelCeiling` (inclusive).
            upgradeCosts = RAFT_UPGRADE_DATA(levelToUpgradeTo).upgradeRequirements.find(requirement => {
                return requirement.levelRange.levelFloor <= levelToUpgradeTo && requirement.levelRange.levelCeiling >= levelToUpgradeTo;
            })?.upgradeCosts ?? null;

            // increase the raft's current level by 1.
            // NOTE: we do this prematurely, but this won't get called until the end of the function, meaning that if an error occurs, the raft's level won't be increased.
            raftUpdateOperations.$inc['currentLevel'] = 1;
        }

        if (!upgradeCosts) {
            return {
                status: Status.ERROR,
                message: `(universalAssetUpgrade) Upgrade costs not found for level ${levelToUpgradeTo}.`,
            };
        }

        // check if the cost group is valid.
        if (upgradeCosts && finalizedCostGroup >= upgradeCosts.length) {
            return {
                status: Status.ERROR,
                message: `(universalAssetUpgrade) Upgrade cost group ${finalizedCostGroup} not found.`,
            };
        }

        // get the upgrade cost group.
        const { xCookies: requiredXCookies, assetData: requiredAssetsData } = upgradeCosts[finalizedCostGroup];

        // if xCookies > 0, check if the user has enough xCookies to upgrade.
        if (requiredXCookies > 0) {
            if (user.inventory?.xCookieData.currentXCookies < requiredXCookies) {
                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) Not enough xCookies to upgrade.`,
                };
            }

            // deduct the required xCookies from the user's inventory, and increase the `totalXCookiesSpent` and `weeklyXCookiesSpent` by the required amount.
            userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = -requiredXCookies;
            userUpdateOperations.$inc['inventory.xCookieData.totalXCookiesSpent'] = requiredXCookies;
            userUpdateOperations.$inc['inventory.xCookieData.weeklyXCookiesSpent'] = requiredXCookies;
        }

        // if required assets is not null, check if the user has enough of the required assets to upgrade.
        if (requiredAssetsData && requiredAssetsData.length > 0) {
            for (const requiredAssetData of requiredAssetsData) {
                // check the asset type
                const { assetType: requiredAssetType, amount: requiredAssetAmount, asset: requiredAsset } = requiredAssetData;

                if (requiredAssetType === 'food') {
                    // if food is required, check the user's inventory for the required food.
                    const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === requiredAsset);

                    // if food index is -1, the required food is not found in the user's inventory.
                    if (foodIndex === -1) {
                        return {
                            status: Status.ERROR,
                            message: `(universalAssetUpgrade) Required food ${requiredAsset} not found in user's inventory.`,
                        };
                    }

                    // if the user has the required food, check if the amount is enough.
                    if ((user.inventory?.foods as Food[])[foodIndex].amount < requiredAssetAmount) {
                        return {
                            status: Status.ERROR,
                            message: `(universalAssetUpgrade) Not enough ${requiredAsset} to upgrade the bit.`,
                        };
                    }

                    // deduct the required food from the user's inventory.
                    userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = -requiredAssetAmount;
                } else if (requiredAssetType === 'item') {
                    // if item is required, check the user's inventory for the required item.
                    const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === requiredAsset);

                    // if item index is -1, the required item is not found in the user's inventory.
                    if (itemIndex === -1) {
                        return {
                            status: Status.ERROR,
                            message: `(universalAssetUpgrade) Required item ${requiredAsset} not found in user's inventory.`,
                        };
                    }

                    // if the user has the required item, check if the amount is enough.
                    if ((user.inventory?.items as Item[])[itemIndex].amount < requiredAssetAmount) {
                        return {
                            status: Status.ERROR,
                            message: `(universalAssetUpgrade) Not enough ${requiredAsset} to upgrade the bit.`,
                        };
                    }

                    // deduct the required item from the user's inventory.
                    userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = -requiredAssetAmount;
                } else if (requiredAssetType === 'resource') {
                    // if resource is required, check the user's inventory for the required resource.
                    const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === requiredAsset);

                    // if resource index is -1, the required resource is not found in the user's inventory.
                    if (resourceIndex === -1) {
                        return {
                            status: Status.ERROR,
                            message: `(universalAssetUpgrade) Required resource ${requiredAsset} not found in user's inventory.`,
                        };
                    }

                    // if the user has the required resource, check if the amount is enough.
                    if ((user.inventory?.resources as ExtendedResource[])[resourceIndex].amount < requiredAssetAmount) {
                        return {
                            status: Status.ERROR,
                            message: `(universalAssetUpgrade) Not enough ${requiredAsset} to upgrade the bit.`,
                        };
                    }

                    // deduct the required resource from the user's inventory.
                    userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = -requiredAssetAmount;
                }
            }
        }

        // do the update operations.
        await UserModel.updateOne({ twitterId }, {
            $set: userUpdateOperations.$set,
            $inc: userUpdateOperations.$inc,
        });

        await UserModel.updateOne({ twitterId }, {
            $push: userUpdateOperations.$push,
            $pull: userUpdateOperations.$pull,
        });

        if (asset === UpgradableAsset.BIT) {
            await BitModel.updateOne({ bitId: islandOrBitId }, {
                $set: bitUpdateOperations.$set,
                $inc: bitUpdateOperations.$inc,
            });

            await BitModel.updateOne({ bitId: islandOrBitId }, {
                $push: bitUpdateOperations.$push,
                $pull: bitUpdateOperations.$pull,
            });
        } else if (asset === UpgradableAsset.ISLAND) {
            await IslandModel.updateOne({ islandId: islandOrBitId }, {
                $set: islandUpdateOperations.$set,
                $inc: islandUpdateOperations.$inc,
            });

            await IslandModel.updateOne({ islandId: islandOrBitId }, {
                $push: islandUpdateOperations.$push,
                $pull: islandUpdateOperations.$pull,
            });
        }  else if (asset === UpgradableAsset.RAFT) {
            await RaftModel.updateOne({ raftId: user.inventory.raftId }, {
                $set: raftUpdateOperations.$set,
                $inc: raftUpdateOperations.$inc,
            });

            await RaftModel.updateOne({ raftId: user.inventory.raftId }, {
                $push: raftUpdateOperations.$push,
                $pull: raftUpdateOperations.$pull,
            });
        }
        // no need to worry about berry factory because that's included in the user update operations.

        return {
            status: Status.SUCCESS,
            message: `(universalAssetUpgrade) Successfully upgraded ${asset} to level ${levelToUpgradeTo}.`,
            data: {
                upgradedAsset: 
                    asset === UpgradableAsset.BIT ? `Bit ID: ${islandOrBitId}` 
                    : asset === UpgradableAsset.ISLAND ? `Island ID: ${islandOrBitId}` 
                    : asset === UpgradableAsset.RAFT ? `Raft ID: ${user.inventory.raftId}`
                    : asset === UpgradableAsset.BERRY_FACTORY ? `Berry Factory at ${poi}`
                    : null,
                upgradedToLevel: levelToUpgradeTo,
                totalPaid: {
                    xCookies: requiredXCookies,
                    assets: requiredAssetsData,
                },
                currencyData: [
                    {
                        currency: 'xCookies',
                        prevAmount: user.inventory?.xCookieData.currentXCookies + requiredXCookies,
                        newAmount: user.inventory?.xCookieData.currentXCookies,
                    },
                    // map through required assets (if any) and return the previous and new amounts.
                    ...(requiredAssetsData ? requiredAssetsData.map(requiredAssetData => {
                        const { assetType, asset, amount } = requiredAssetData;

                        if (assetType === 'food') {
                            const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === asset);

                            return {
                                currency: asset,
                                prevAmount: (user.inventory?.foods as Food[])[foodIndex].amount + amount,
                                newAmount: (user.inventory?.foods as Food[])[foodIndex].amount,
                            };
                        } else if (assetType === 'item') {
                            const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === asset);

                            return {
                                currency: asset,
                                prevAmount: (user.inventory?.items as Item[])[itemIndex].amount + amount,
                                newAmount: (user.inventory?.items as Item[])[itemIndex].amount,
                            };
                        } else if (assetType === 'resource') {
                            const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === asset);

                            return {
                                currency: asset,
                                prevAmount: (user.inventory?.resources as ExtendedResource[])[resourceIndex].amount + amount,
                                newAmount: (user.inventory?.resources as ExtendedResource[])[resourceIndex].amount,
                            };
                        }
                    }) : []),
                ]
            }
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(universalAssetUpgrade) ${err.message}`,
        };
    }
}