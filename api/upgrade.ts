import { eventarc } from 'googleapis/build/src/apis/eventarc';
import { BitRarity } from '../models/bit';
import { Food } from '../models/food';
import { Item } from '../models/item';
import { BerryFactoryMastery } from '../models/mastery';
import { POIName } from '../models/poi';
import { ExtendedResource } from '../models/resource';
import { AssetUpgradeRequirement, UpgradableAsset, UpgradeCost } from '../models/upgrade';
import { PlayerMastery } from '../models/user';
import { MAX_BIT_LEVEL } from '../utils/constants/bit';
import { BitModel, IslandModel, RaftModel, UserModel } from '../utils/constants/db';
import { MAX_ISLAND_LEVEL } from '../utils/constants/island';
import { BIT_UPGRADE_DATA, ISLAND_UPGRADE_DATA, RAFT_UPGRADE_DATA } from '../utils/constants/upgrade';
import { ReturnValue, Status } from '../utils/retVal';
import { toCamelCase } from '../utils/strings';
import { AssetType } from '../models/asset';
import { resources } from '../utils/constants/resource';

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
    // this should only be used if one or more of the required assets within the upgrade cost group doesn't require a specific asset type to be submitted (aka flexible required assets).
    // for example, some upgradable assets can allow players to submit X amount of ANY common rarity resource to upgrade it.
    // let's say the requirement is 10 of ANY common resource. a user can submit 10 of resource A or 10 of resource B, or even a combination of multiple different common resources to make up 10 total.
    // this `chosenFlexibleRequiredAssets` array should contain the additional assets that the user wants to submit to meet the "10 of any common resource" requirement.
    // this will then be checked against the required assets in the chosen asset group to see if the user has inputted the correct amount of the specific flexible assets.
    chosenFlexibleRequiredAssets?: Array<{
        specificAsset: AssetType,
        assetCategory: 'resource' | 'food' | 'item',
        amount: number,
    }>,
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

        // if required assets is not null, check if the user has enough of the required assets (and chosen flexible assets) to upgrade.
        if (requiredAssetsData && requiredAssetsData.length > 0) {
            // a boolean to check if the user has all the required assets to upgrade the asset. if any of the required assets are not owned by the user, this will be set to false.
            let allRequiredAssetsOwned = true;
            // as mentioned in the parameter `chosenFlexibleRequiredAssets`, some recipes may require players to have to manually input the specific assets they want to use to upgrade the asset.
            // for example, if the recipe requires the player to submit 10 of ANY common resource, the player can, for example:
            // input 1. 2 of common resource A, 2. 3 of common resource B, 3. 3 of common resource C and 4. 2 of common resource D (to make 10 in total).
            // this array will contain all of these flexible assets required, and for each `chosenFlexibleRequiredAsset`, if valid, we will deduct the `amount` of the respective `remainingFlexibleRequiredAsset`.
            // for example, let's use the example above (2 of A, 3 of B, 3 of C and 2 of D). to start with, one of the indexes of `remainingFlexibleRequiredAssets` will require 10 of ANY common resource.
            // after looping through A, the index's amount will be reduced by 2 to become 8. then, after looping through B, it will become 5, and so on.
            // when the amount reaches 0, the index will be spliced from the array.
            // only when `remainingFlexibleRequiredAssets` end up being empty will we consider the user to have inputted the correct amount of the flexible assets.
            const remainingFlexibleRequiredAssets: AssetUpgradeRequirement[] = JSON.parse(
                JSON.stringify(
                    requiredAssetsData.filter(requiredAssetData => requiredAssetData.specificAsset === 'any')
                )
            );
            // a boolean to check if the user has all the flexible required assets to upgrade the asset. if any of the flexible required assets are not owned by the user, this will be set to false.
            // `remainingFlexibleRequiredAssets` only checks if the user has inputted the correct amount of the flexible assets.
            // `allFlexibleRequiredAssetsOwned` will check if the user OWNS the correct amount of the flexible assets. if the user doesn't own the correct amount, this will be set to false.
            let allFlexibleRequiredAssetsOwned = true;

            // divide into the flexible assets and the non-flexible (i.e. specificAsset !== 'any') assets.
            // unlike `remainingFlexibleRequiredAssets`, we will multiply the amounts manually when we for loop each flexible required asset to check for the user's input.
            const flexibleRequiredAssets = requiredAssetsData.filter(requiredAsset => requiredAsset.specificAsset === 'any');
            const requiredAssets = requiredAssetsData.filter(requiredAsset => requiredAsset.specificAsset !== 'any');

            // used to calculate the total weight to reduce from the user's inventory (since assets will be removed)
            let totalWeightToReduce = 0;

            // loop through the flexible required assets first. this will check against the `chosenFlexibleRequiredAssets` array to see if the user has inputted the correct amount of the flexible assets.
            for (const flexibleRequiredAsset of flexibleRequiredAssets) {
                console.log(`(universalAssetUpgrade) flexibleRequiredAsset: ${JSON.stringify(flexibleRequiredAsset)}`);
                const requiredAssetCategory = flexibleRequiredAsset.assetCategory;
                const requiredAssetRarity = flexibleRequiredAsset.requiredRarity;
                const requiredAssetAmount = flexibleRequiredAsset.amount;

                // if `requiredAssetCategory` is resource, we need to manually check the rarity of the resources inputted in the `chosenFlexibleRequiredAssets` array.
                if (requiredAssetCategory === 'resource') {
                    // loop through the `chosenFlexibleRequiredAssets` array and fetch only the resources.
                    // then, fetch the resource data for each resource. we then filter the resources to get the ones that match the `requiredAssetRarity`.
                    // then, we sum up the amount of the resources that match the `requiredAssetRarity` and check if it's equal to the `requiredAssetAmount`.
                    const flexibleResources = chosenFlexibleRequiredAssets.filter(asset => asset.assetCategory === 'resource');
                    console.log(`(universalAssetUpgrade) flexibleResources: ${JSON.stringify(flexibleResources)}`);
                    // fetch the resources data for the flexible resources and filter them by the required rarity.
                    const flexibleResourceData = flexibleResources.map(resource => resources.find(r => r.type === resource.specificAsset)).filter(resource => resource?.rarity === requiredAssetRarity);
                    console.log(`(universalAssetUpgrade) flexibleResourceData: ${JSON.stringify(flexibleResourceData)}`);

                    if (flexibleResourceData.length === 0) {
                        console.log(`(universalAssetUpgrade) User didn't input the correct amount of ${requiredAssetRarity} resources (1)`);

                        allFlexibleRequiredAssetsOwned = false;
                        break;
                    }

                    const totalFlexibleResourceAmount = flexibleResources.reduce((acc, resource) => {
                        // Find the resource in flexibleResourceData
                        const foundResource = flexibleResourceData.find(data => data.type === resource.specificAsset);
                        // Only increment the amount if the resource exists in `flexibleResourceData`
                        if (foundResource) {
                            return acc + resource.amount;
                        }
                        // Return the accumulator unchanged if the resource does not match
                        return acc;
                    }, 0);

                    if (totalFlexibleResourceAmount !== requiredAssetAmount) {
                        console.log(`(universalAssetUpgrade) User didn't input the correct amount of ${requiredAssetRarity} resources (2). ${totalFlexibleResourceAmount} === ${requiredAssetAmount}`);

                        allFlexibleRequiredAssetsOwned = false;
                        break;
                    }

                    // if the user has inputted the correct amount of the flexible resources, we need to deduct the amount from the `remainingFlexibleRequiredAssets` array.
                    remainingFlexibleRequiredAssets.find(asset => asset.requiredRarity === requiredAssetRarity).amount -= requiredAssetAmount;

                    // if the amount of the flexible resource is 0, remove it from the array.
                    if (remainingFlexibleRequiredAssets.find(asset => asset.requiredRarity === requiredAssetRarity).amount === 0) {
                        remainingFlexibleRequiredAssets.splice(remainingFlexibleRequiredAssets.findIndex(asset => asset.requiredRarity === requiredAssetRarity), 1);
                    }

                    // now we just need to check if the user owns the correct amount of the flexible resources.
                    // for example, if 2 of common resource A, 3 of common resource B, 3 of common resource C and 2 of common resource D are inputted,
                    // then the user needs to own AT LEAST 2 of common resource A, 3 of common resource B, 3 of common resource C and 2 of common resource D.
                    for (const flexibleResource of flexibleResourceData) {
                        const userResource = (user.inventory?.resources as ExtendedResource[]).find(resource => resource.type === flexibleResource.type);
                        const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === flexibleResource.type);

                        if (!userResource || userResource.amount < flexibleResources.find(resource => resource.specificAsset === flexibleResource.type)?.amount) {
                            console.log(`(universalAssetUpgrade) User doesn't own the correct amount of ${flexibleResource.type}`);

                            allFlexibleRequiredAssetsOwned = false;
                            break;
                        }

                        // deduct the required resource from the user's inventory. no need to worry about the operation being called because
                        // if the next assets' checks fail, the function will return an error and the user's inventory won't be updated.
                        userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = -flexibleResources.find(resource => resource.specificAsset === flexibleResource.type)?.amount;
                    }

                    // get the total weight to reduce based on the flexible resources
                    totalWeightToReduce += flexibleResourceData.reduce((acc, resource) => {
                        return acc + (resource.weight * flexibleResources.find(r => r.specificAsset === resource.type)?.amount);
                    }, 0);
                } else if (requiredAssetCategory === 'food') {
                    // food has no rarity, so we simply just check if the user has inputted the correct amount of the food.
                    // e.g. if the recipe, say, requires 10 of any food, the user can input 5 burgers, 2 candies and 3 juices.
                    // we just need to check if the user has inputted 10 food items in total.
                    const flexibleFoods = chosenFlexibleRequiredAssets.filter(asset => asset.assetCategory === 'food');

                    const totalFlexibleFoodAmount = flexibleFoods.reduce((acc, food) => {
                        return acc + food.amount;
                    }, 0);

                    if (totalFlexibleFoodAmount !== requiredAssetAmount) {
                        console.log(`(universalAssetUpgrade) User didn't input the correct amount of food`);

                        allFlexibleRequiredAssetsOwned = false;
                        break;
                    }

                    // if the user has inputted the correct amount of the flexible foods, we need to deduct the amount from the `remainingFlexibleRequiredAssets` array.
                    remainingFlexibleRequiredAssets.find(asset => asset.assetCategory === 'food').amount -= requiredAssetAmount;

                    // if the amount of the flexible food is 0, remove it from the array.
                    if (remainingFlexibleRequiredAssets.find(asset => asset.assetCategory === 'food').amount === 0) {
                        remainingFlexibleRequiredAssets.splice(remainingFlexibleRequiredAssets.findIndex(asset => asset.assetCategory === 'food'), 1);
                    }

                    // now we just need to check if the user owns the correct amount of the flexible foods.
                    // for example, if 5 burgers, 2 candies and 3 juices are inputted,
                    // then the user needs to own AT LEAST 5 burgers, 2 candies and 3 juices.
                    for (const flexibleFood of flexibleFoods) {
                        const userFood = (user.inventory?.foods as Food[]).find(food => food.type === flexibleFood.specificAsset);
                        const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === flexibleFood.specificAsset);

                        if (!userFood || userFood.amount < flexibleFood.amount) {
                            console.log(`(universalAssetUpgrade) User doesn't own the correct amount of ${flexibleFood.specificAsset}`);

                            allFlexibleRequiredAssetsOwned = false;
                            break;
                        }

                        // deduct the required food from the user's inventory. no need to worry about the operation being called because
                        // if the next assets' checks fail, the function will return an error and the user's inventory won't be updated.
                        userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = -flexibleFood.amount;
                    }

                    // get the total weight to reduce based on the flexible foods
                    totalWeightToReduce += flexibleFoods.reduce((acc, food) => {
                        // right now, it's 0 because food doesn't have weight
                        return acc + (food.amount * 0);
                    }, 0);
                } else if (requiredAssetCategory === 'item') {
                    // item has no rarity, so we simply just check if the user has inputted the correct amount of the item.
                    // e.g. if the recipe, say, requires 10 of any item, the user can input 5 of item A and 5 of item B.
                    // we just need to check if the user has inputted 10 items in total.
                    const flexibleItems = chosenFlexibleRequiredAssets.filter(asset => asset.assetCategory === 'item');

                    const totalFlexibleItemAmount = flexibleItems.reduce((acc, item) => {
                        return acc + item.amount;
                    }, 0);

                    if (totalFlexibleItemAmount !== requiredAssetAmount) {
                        console.log(`(universalAssetUpgrade) User didn't input the correct amount of items`);

                        allFlexibleRequiredAssetsOwned = false;
                        break;
                    }
                    
                    // if the user has inputted the correct amount of the flexible items, we need to deduct the amount from the `remainingFlexibleRequiredAssets` array.
                    remainingFlexibleRequiredAssets.find(asset => asset.assetCategory === 'item').amount -= requiredAssetAmount;

                    // if the amount of the flexible item is 0, remove it from the array.
                    if (remainingFlexibleRequiredAssets.find(asset => asset.assetCategory === 'item').amount === 0) {
                        remainingFlexibleRequiredAssets.splice(remainingFlexibleRequiredAssets.findIndex(asset => asset.assetCategory === 'item'), 1);
                    }

                    // now we just need to check if the user owns the correct amount of the flexible items.
                    // for example, if 5 of item A and 5 of item B are inputted,
                    // then the user needs to own AT LEAST 5 of item A and 5 of item B.
                    for (const flexibleItem of flexibleItems) {
                        const userItem = (user.inventory?.items as Item[]).find(item => item.type === flexibleItem.specificAsset);
                        const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === flexibleItem.specificAsset);

                        if (!userItem || userItem.amount < flexibleItem.amount) {
                            console.log(`(universalAssetUpgrade) User doesn't own the correct amount of ${flexibleItem.specificAsset}`);

                            allFlexibleRequiredAssetsOwned = false;
                            break;
                        }

                        // deduct the required item from the user's inventory. no need to worry about the operation being called because
                        // if the next assets' checks fail, the function will return an error and the user's inventory won't be updated.
                        userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = -flexibleItem.amount;
                    }

                    // get the total weight to reduce based on the flexible items
                    totalWeightToReduce += flexibleItems.reduce((acc, item) => {
                        // right now, it's 0 because items don't have weight
                        return acc + (item.amount * 0);
                    }, 0);
                }
            }

            // now, loop through the non-flexible required assets. because non-flexible required assets will require a specific asset,
            // we just need to check if the user owns at least the required amount of the specific asset.
            for (const requiredAsset of requiredAssets) {
                // note: no need to check for rarity because the required asset is always a specific asset.
                const requiredAssetCategory = requiredAsset.assetCategory;
                const requiredAssetType = requiredAsset.specificAsset;
                const requiredAssetAmount = requiredAsset.amount;

                if (requiredAssetCategory === 'resource') {
                    const userResource = (user.inventory?.resources as ExtendedResource[]).find(resource => resource.type === requiredAssetType);
                    const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === requiredAssetType);

                    if (!userResource || userResource.amount < requiredAssetAmount) {
                        console.log(`(universalAssetUpgrade) User doesn't own the correct amount of ${requiredAssetType}`);

                        allRequiredAssetsOwned = false;
                        break;
                    }

                    // get the total weight to reduce based on the non-flexible resources
                    totalWeightToReduce += resources.find(resource => resource.type === requiredAssetType)?.weight * requiredAssetAmount;

                    // deduct the required resource from the user's inventory. no need to worry about the operation being called because
                    // if the next assets' checks fail, the function will return an error and the user's inventory won't be updated.
                    userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = -requiredAssetAmount;
                } else if (requiredAssetCategory === 'food') {
                    const userFood = (user.inventory?.foods as Food[]).find(food => food.type === requiredAssetType);
                    const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === requiredAssetType);

                    if (!userFood || userFood.amount < requiredAssetAmount) {
                        console.log(`(universalAssetUpgrade) User doesn't own the correct amount of ${requiredAssetType}`);

                        allRequiredAssetsOwned = false;
                        break;
                    }

                    // get the total weight to reduce based on the non-flexible foods
                    // right now, it's 0 because food doesn't have weight
                    totalWeightToReduce += 0;

                    // deduct the required food from the user's inventory. no need to worry about the operation being called because
                    // if the next assets' checks fail, the function will return an error and the user's inventory won't be updated.
                    userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = -requiredAssetAmount;
                } else if (requiredAssetCategory === 'item') {
                    const userItem = (user.inventory?.items as Item[]).find(item => item.type === requiredAssetType);
                    const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === requiredAssetType);

                    if (!userItem || userItem.amount < requiredAssetAmount) {
                        console.log(`(universalAssetUpgrade) User doesn't own the correct amount of ${requiredAssetType}`);

                        allRequiredAssetsOwned = false;
                        break;
                    }

                    // get the total weight to reduce based on the non-flexible items
                    // right now, it's 0 because items don't have weight
                    totalWeightToReduce += 0;

                    // deduct the required item from the user's inventory. no need to worry about the operation being called because
                    // if the next assets' checks fail, the function will return an error and the user's inventory won't be updated.
                    userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = -requiredAssetAmount;
                }
            }

            // check if 1. `allRequiredAssetsOwned` is true and `allFlexibleRequiredAssetsOwned` is true, and 2. `remainingFlexibleRequiredAssets` is empty.
            // if both conditions are met, the function logic continues (meaning that the asset check has passed).
            if (!allRequiredAssetsOwned) {
                console.log(`(universalAssetUpgrade) allRequiredAssetsOwned check failed.`);

                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) allRequiredAssetsOwned check failed. Please try again.`
                }
            }

            if (!allFlexibleRequiredAssetsOwned) {
                console.log(`(universalAssetUpgrade) allFlexibleRequiredAssetsOwned check failed.`);

                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) allFlexibleRequiredAssetsOwned check failed. Please try again.`
                }
            }

            if (remainingFlexibleRequiredAssets.length > 0) {
                console.log(`(universalAssetUpgrade) remainingFlexibleRequiredAssets check failed.`);
                console.log(`remainingFlexibleRequiredAssets data: ${JSON.stringify(remainingFlexibleRequiredAssets, null, 2)}`);

                return {
                    status: Status.ERROR,
                    message: `(universalAssetUpgrade) remainingFlexibleRequiredAssets check failed. Please try again.`
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

        return {
            status: Status.SUCCESS,
            message: `(universalAssetUpgrade) Successfully upgraded ${asset} to level ${levelToUpgradeTo}.`,
            data: {
                upgradedAsset: 
                    asset === UpgradableAsset.BIT ? `Bit ID: ${islandOrBitId}` 
                    : asset === UpgradableAsset.ISLAND ? `Island ID: ${islandOrBitId}` 
                    : asset === UpgradableAsset.RAFT ? `Raft ID: ${user.inventory.raftId}`
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
                    // map through the chosen flexible required assets and return the previous and new amounts.
                    ...(chosenFlexibleRequiredAssets ? chosenFlexibleRequiredAssets.map(chosenFlexibleRequiredAsset => {
                        const { specificAsset, assetCategory, amount } = chosenFlexibleRequiredAsset;

                        if (assetCategory === 'food') {
                            const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === specificAsset);

                            return {
                                currency: specificAsset,
                                prevAmount: (user.inventory?.foods as Food[])[foodIndex].amount + amount,
                                newAmount: (user.inventory?.foods as Food[])[foodIndex].amount,
                            };
                        } else if (assetCategory === 'item') {
                            const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === specificAsset);

                            return {
                                currency: specificAsset,
                                prevAmount: (user.inventory?.items as Item[])[itemIndex].amount + amount,
                                newAmount: (user.inventory?.items as Item[])[itemIndex].amount,
                            };
                        } else if (assetCategory === 'resource') {
                            const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === specificAsset);

                            return {
                                currency: specificAsset,
                                prevAmount: (user.inventory?.resources as ExtendedResource[])[resourceIndex].amount + amount,
                                newAmount: (user.inventory?.resources as ExtendedResource[])[resourceIndex].amount,
                            };
                        }
                    }) : []),
                    // map through the required assets (that are NOT specifiedAsset === 'any') and return the previous and new amounts.
                    ...(requiredAssetsData ? requiredAssetsData.filter(assetData => assetData.specificAsset !== 'any').map(requiredAssetData => {
                        const { assetCategory, specificAsset, amount } = requiredAssetData;

                        if (assetCategory === 'food') {
                            const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === specificAsset);

                            return {
                                currency: specificAsset,
                                prevAmount: (user.inventory?.foods as Food[])[foodIndex].amount + amount,
                                newAmount: (user.inventory?.foods as Food[])[foodIndex].amount,
                            };
                        } else if (assetCategory === 'item') {
                            const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === specificAsset);

                            return {
                                currency: specificAsset,
                                prevAmount: (user.inventory?.items as Item[])[itemIndex].amount + amount,
                                newAmount: (user.inventory?.items as Item[])[itemIndex].amount,
                            };
                        } else if (assetCategory === 'resource') {
                            const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === specificAsset);

                            return {
                                currency: specificAsset,
                                prevAmount: (user.inventory?.resources as ExtendedResource[])[resourceIndex].amount + amount,
                                newAmount: (user.inventory?.resources as ExtendedResource[])[resourceIndex].amount,
                            };
                        }
                    }) : [])
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