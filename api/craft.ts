import { ClientSession } from 'mongoose';
import { AssetType } from '../models/asset';
import {
    CraftableAsset,
    CraftingRecipeRequiredAssetData,
    CraftingQueueStatus,
    CraftingRecipeLine,
    CraftedAssetRarity,
    CraftingResult,
    CraftingResultType,
} from '../models/craft';
import { Food } from '../models/food';
import { Item } from '../models/item';
import { CraftingMastery, CraftingMasteryStats } from '../models/mastery';
import { ExtendedResource, ExtendedResourceOrigin } from '../models/resource';
import {
    BASE_CRAFTABLE_PER_SLOT,
    BASE_CRAFTING_SLOTS,
    CANCEL_CRAFT_X_COOKIES_COST,
    CRAFT_QUEUE,
    CRAFTING_RECIPES,
    GET_CRAFTING_CRITICAL_RATE,
    GET_CRAFTING_SUCCESS_RATE,
    GET_PROFESSION_REQUIRED_XP,
    REQUIRED_POI_FOR_CRAFTING_LINE,
} from '../utils/constants/craft';
import { CraftingQueueModel, UserModel, TEST_CONNECTION } from '../utils/constants/db';
import { resources } from '../utils/constants/resource';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { toCamelCase, toPascalCase } from '../utils/strings';
import { batchAddToInventory, batchDeductFromInventory } from './inventory';
import { addPoints } from './leaderboard';
import { PointsSource } from '../models/user';

/**
 * Crafts a craftable asset for the user.
 *
 * A new `CraftingQueue` instance will be created for the crafted asset, and the user's inventory will be updated accordingly once the duration expires.
 */
export const craftAsset = async (
    twitterId: string,
    assetToCraft: CraftableAsset,
    amount: number = 1,
    // the asset group to choose from to craft the asset. see `CraftingRecipe.requiredAssetGroups` for more details.
    // if a recipe only has 1 asset group, this can be ignored. any number above 1 will return an error.
    chosenAssetGroup: number = 0,
    // this should only be used if one or more of the required assets within the chosen asset group doesn't require a specific asset type to be submitted (aka flexible required assets).
    // for example, some recipes can allow players to submit X amount of ANY common rarity resource.
    // let's say a recipe requires 10 of ANY common resource. a user can submit 10 of resource A or 10 of resource B, or even a combination of multiple different common resources to make up 10 total.
    // this `chosenFlexibleRequiredAssets` array should contain the additional assets that the user wants to submit to meet the "10 of any common resource" requirement.
    // this will then be checked against the required assets in the chosen asset group to see if the user has inputted the correct amount of the specific flexible assets.
    chosenFlexibleRequiredAssets: Array<{
        specificAsset: AssetType;
        assetCategory: 'resource' | 'food' | 'item';
        amount: number;
    }>,
    _session?: ClientSession
): Promise<ReturnValue> => {
    // get the asset data from `CRAFTING_RECIPES` by querying the craftedAssetData.asset
    const craftingRecipe = CRAFTING_RECIPES.find((recipe) => recipe.craftedAssetData.asset === assetToCraft);

    console.log('(craftAsset), chosenFlexibleRequiredAssets: ', JSON.stringify(chosenFlexibleRequiredAssets, null, 2));

    if (!craftingRecipe) {
        console.log(`(craftAsset) Crafting recipe not found.`);

        return {
            status: Status.ERROR,
            message: `(craftAsset) Crafting recipe not found.`,
        };
    }

    const session = _session ?? (await TEST_CONNECTION.startSession());
    if (!_session) session.startTransaction();

    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            throw new Error('User not found.');
        }

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {},
        };

        // check if the user has enough energy to craft the asset
        const energyRequired = craftingRecipe.baseEnergyRequired * amount;

        if (user.inGameData.energy.currentEnergy < energyRequired) {
            throw new Error(`(craftAsset) Not enough energy to craft ${amount}x ${assetToCraft}.`);
        }

        // fetch all ongoing OR claimable crafting queues (for the chosen line) because these occupy the user's crafting slots.
        // NOTE: partially cancelled claimable queues also occupy a slot, so we need to include them in the query.
        const craftingQueues = await CraftingQueueModel.find({
            userId: user._id,
            status: {
                $in: [
                    CraftingQueueStatus.ONGOING,
                    CraftingQueueStatus.CLAIMABLE,
                    CraftingQueueStatus.PARTIALLY_CANCELLED_CLAIMABLE,
                ],
            },
            craftingRecipeLine: craftingRecipe.craftingRecipeLine,
        }).lean();

        // check if the user is in the right POI to craft assets and if they have reached the limit to craft the asset.
        const requiredPOI = REQUIRED_POI_FOR_CRAFTING_LINE(craftingRecipe.craftingRecipeLine);

        if (user.inGameData.location !== requiredPOI) {
            throw new Error(
                `(craftAsset) User is not in the right POI to craft ${assetToCraft}. Required POI: ${requiredPOI}, User POI: ${user.inGameData.location}`
            );
        }

        // check their crafting slots for this particular crafting line (via their mastery data)
        const masteryData =
            (user.inGameData.mastery?.crafting?.[
                craftingRecipe.craftingRecipeLine.toLowerCase()
            ] as CraftingMasteryStats) ?? null;

        console.log(
            `mastery data for line ${craftingRecipe.craftingRecipeLine}: ${JSON.stringify(masteryData, null, 2)}`
        );

        let craftingSlots = 0;
        let craftablePerSlot = 0;

        // if masteryData doesn't exist, we will assume that they SHOULD have the base crafting slots and craftable per slot counts.
        // no need to instantiate the masteryData object here because it will be done at the end of the function.
        if (!masteryData) {
            craftingSlots = BASE_CRAFTING_SLOTS;
            craftablePerSlot = BASE_CRAFTABLE_PER_SLOT;
        } else {
            // otherwise, fetch the `craftingSlots` and `craftablePerSlot` from the mastery data
            // again, just in case the mastery data does exist BUT the crafting slots/craftable per slot doesn't, we will assume that they SHOULD have the base crafting slots and craftable per slot counts.
            craftingSlots = masteryData.craftingSlots ?? BASE_CRAFTING_SLOTS;
            craftablePerSlot = masteryData.craftablePerSlot ?? BASE_CRAFTABLE_PER_SLOT;
        }

        console.log(
            `User ${user.twitterUsername} has ${craftingSlots} crafting slots and can craft ${craftablePerSlot} of ${assetToCraft} per slot for line ${craftingRecipe.craftingRecipeLine}.`
        );

        // throw IF craftingQueues >= craftingSlots
        if (craftingQueues.length >= craftingSlots) {
            console.log(
                `(craftAsset) User has reached the crafting slots limit for ${craftingRecipe.craftingRecipeLine}.`
            );

            throw new Error(
                `(craftAsset) User has reached the crafting slots limit for ${craftingRecipe.craftingRecipeLine}.`
            );
        }

        // throw IF `amount` specified in params > craftablePerSlot
        if (amount > craftablePerSlot) {
            throw new Error(
                `(craftAsset) Amount exceeds the craftable per slot limit for ${craftingRecipe.craftingRecipeLine}.`
            );
        }

        // if `requiredXCookies` > 0, check if the user has enough xCookies to craft the asset
        if (craftingRecipe.requiredXCookies > 0) {
            if (user.inventory?.xCookieData.currentXCookies < craftingRecipe.requiredXCookies) {
                throw new Error(`Not enough xCookies to craft ${amount}x ${assetToCraft}.`);
            }
        }

        // if `requiredCraftingLevel` !== none, check if the user has the required crafting level to craft the asset (within the line)
        if (craftingRecipe.requiredCraftingLevel !== 'none') {
            // if the required crafting level is 1, then continue. some users might not have the crafting level set up in the schema,
            // so we don't need to worry.
            // only when the required crafting level is above 1 will we need to check if the user has the required crafting level.
            if (craftingRecipe.requiredCraftingLevel > 1) {
                if (
                    user.inGameData.mastery.crafting[toCamelCase(craftingRecipe.craftingRecipeLine)].level <
                    craftingRecipe.requiredCraftingLevel
                ) {
                    throw new Error(`(craftAsset) User crafting level too low to craft ${assetToCraft}.`);
                }
            }
        }

        // check if the user has the required assets to craft the asset (which is also multiplied by the `amount`) based on the `chosenAssetGroup`.
        // if the user doesn't have the required assets, return an error.
        // firstly, check if the recipe has multiple asset groups. if it does, check if the chosenAssetGroup is within the boundary of the length.
        if (
            (craftingRecipe.requiredAssetGroups.length === 1 && chosenAssetGroup > 0) ||
            (craftingRecipe.requiredAssetGroups.length > 1 &&
                chosenAssetGroup > craftingRecipe.requiredAssetGroups.length - 1) ||
            chosenAssetGroup < 0
        ) {
            throw new Error('Chosen asset group out of bounds.');
        }

        // a boolean to check if the user has all the required assets to craft the asset. if any of the required assets are not owned by the user, this will be set to false.
        let allRequiredAssetsOwned = true;
        // as mentioned in the parameter `chosenFlexibleRequiredAssets`, some recipes may require players to have to manually input the specific assets they want to use to craft the asset.
        // for example, if the recipe requires the player to submit 10 of ANY common resource, the player can, for example:
        // input 1. 2 of common resource A, 2. 3 of common resource B, 3. 3 of common resource C and 4. 2 of common resource D (to make 10 in total).
        // this array will contain all of these flexible assets required, and for each `chosenFlexibleRequiredAsset`, if valid, we will deduct the `amount` of the respective `remainingFlexibleRequiredAsset`.
        // for example, let's use the example above (2 of A, 3 of B, 3 of C and 2 of D). to start with, one of the indexes of `remainingFlexibleRequiredAssets` will require 10 of ANY common resource.
        // after looping through A, the index's amount will be reduced by 2 to become 8. then, after looping through B, it will become 5, and so on.
        // when the amount reaches 0, the index will be spliced from the array.
        // only when `remainingFlexibleRequiredAssets` end up being empty will we consider the user to have inputted the correct amount of the flexible assets.
        const remainingFlexibleRequiredAssets: CraftingRecipeRequiredAssetData[] = JSON.parse(
            JSON.stringify(
                craftingRecipe.requiredAssetGroups[chosenAssetGroup].requiredAssets.filter(
                    (requiredAsset) => requiredAsset.specificAsset === 'any'
                )
            )
        );
        // a boolean to check if the user has all the flexible required assets to craft the asset. if any of the flexible required assets are not owned by the user, this will be set to false.
        // `remainingFlexibleRequiredAssets` only checks if the user has inputted the correct amount of the flexible assets.
        // `allFlexibleRequiredAssetsOwned` will check if the user OWNS the correct amount of the flexible assets. if the user doesn't own the correct amount, this will be set to false.
        let allFlexibleRequiredAssetsOwned = true;

        // we need to update each flexible required asset in `remainingFlexibleRequiredAssets` based on the amount of the asset the user wants to craft.
        // for example, when the recipe requires 15 common resources and 5 uncommon resources, if the user wants to craft 3 of the asset, we need to multiply the amount by 3.
        remainingFlexibleRequiredAssets.forEach((asset) => {
            asset.amount *= amount;
        });

        // divide into the flexible assets and the non-flexible (i.e. specificAsset !== 'any') assets.
        // unlike `remainingFlexibleRequiredAssets`, we will multiply the amounts manually when we for loop each flexible required asset to check for the user's input.
        const flexibleRequiredAssets = craftingRecipe.requiredAssetGroups[chosenAssetGroup].requiredAssets.filter(
            (requiredAsset) => requiredAsset.specificAsset === 'any'
        );
        const requiredAssets = craftingRecipe.requiredAssetGroups[chosenAssetGroup].requiredAssets.filter(
            (requiredAsset) => requiredAsset.specificAsset !== 'any'
        );

        // used to calculate the total weight to reduce from the user's inventory (since assets will be removed)
        let totalWeightToReduce = 0;

        // loop through the flexible required assets first. this will check against the `chosenFlexibleRequiredAssets` array to see if the user has inputted the correct amount of the flexible assets.
        for (const flexibleRequiredAsset of flexibleRequiredAssets) {
            console.log(`(craftAsset) flexibleRequiredAsset: ${JSON.stringify(flexibleRequiredAsset)}`);
            const requiredAssetCategory = flexibleRequiredAsset.assetCategory;
            const requiredAssetRarity = flexibleRequiredAsset.requiredRarity;
            // required asset amount is the base amount required for the recipe multiplied by the amount the user wants to craft.
            const requiredAssetAmount = flexibleRequiredAsset.amount * amount;

            console.log(`(craftAsset) requiredAssetAmount: ${flexibleRequiredAsset.amount} * ${amount}`);

            // if `requiredAssetCategory` is resource, we need to manually check the rarity of the resources inputted in the `chosenFlexibleRequiredAssets` array.
            if (requiredAssetCategory === 'resource') {
                // loop through the `chosenFlexibleRequiredAssets` array and fetch only the resources.
                // then, fetch the resource data for each resource. we then filter the resources to get the ones that match the `requiredAssetRarity`.
                // then, we sum up the amount of the resources that match the `requiredAssetRarity` and check if it's equal to the `requiredAssetAmount`.
                const flexibleResources = chosenFlexibleRequiredAssets.filter(
                    (asset) => asset.assetCategory === 'resource'
                );
                console.log(`(craftAsset) flexibleResources: ${JSON.stringify(flexibleResources)}`);
                // fetch the resources data for the flexible resources and filter them by the required rarity.
                const flexibleResourceData = flexibleResources
                    .map((resource) => resources.find((r) => r.type === resource.specificAsset))
                    .filter((resource) => resource?.rarity === requiredAssetRarity);
                console.log(`(craftAsset) flexibleResourceData: ${JSON.stringify(flexibleResourceData)}`);

                if (flexibleResourceData.length === 0) {
                    console.log(
                        `(craftAsset) User didn't input the correct amount of ${requiredAssetRarity} resources (1)`
                    );

                    allFlexibleRequiredAssetsOwned = false;
                    break;
                }

                const totalFlexibleResourceAmount = flexibleResources.reduce((acc, resource) => {
                    // Find the resource in flexibleResourceData
                    const foundResource = flexibleResourceData.find((data) => data.type === resource.specificAsset);
                    // Only increment the amount if the resource exists in `flexibleResourceData`
                    if (foundResource) {
                        return acc + resource.amount;
                    }
                    // Return the accumulator unchanged if the resource does not match
                    return acc;
                }, 0);

                if (totalFlexibleResourceAmount !== requiredAssetAmount) {
                    console.log(
                        `(craftAsset) User didn't input the correct amount of ${requiredAssetRarity} resources (2). ${totalFlexibleResourceAmount} === ${requiredAssetAmount}`
                    );

                    allFlexibleRequiredAssetsOwned = false;
                    break;
                }

                // if the user has inputted the correct amount of the flexible resources, we need to deduct the amount from the `remainingFlexibleRequiredAssets` array.
                remainingFlexibleRequiredAssets.find((asset) => asset.requiredRarity === requiredAssetRarity).amount -=
                    requiredAssetAmount;

                // if the amount of the flexible resource is 0, remove it from the array.
                if (
                    remainingFlexibleRequiredAssets.find((asset) => asset.requiredRarity === requiredAssetRarity)
                        .amount === 0
                ) {
                    remainingFlexibleRequiredAssets.splice(
                        remainingFlexibleRequiredAssets.findIndex(
                            (asset) => asset.requiredRarity === requiredAssetRarity
                        ),
                        1
                    );
                }

                // now we just need to check if the user owns the correct amount of the flexible resources.
                // for example, if 2 of common resource A, 3 of common resource B, 3 of common resource C and 2 of common resource D are inputted,
                // then the user needs to own AT LEAST 2 of common resource A, 3 of common resource B, 3 of common resource C and 2 of common resource D.
                for (const flexibleResource of flexibleResourceData) {
                    const userResource = (user.inventory?.resources as ExtendedResource[]).find(
                        (resource) => resource.type === flexibleResource.type
                    );

                    if (
                        !userResource ||
                        userResource.amount <
                            flexibleResources.find((resource) => resource.specificAsset === flexibleResource.type)
                                ?.amount
                    ) {
                        console.log(`(craftAsset) User doesn't own the correct amount of ${flexibleResource.type}`);

                        allFlexibleRequiredAssetsOwned = false;
                        break;
                    }
                }

                // get the total weight to reduce based on the flexible resources
                totalWeightToReduce += flexibleResourceData.reduce((acc, resource) => {
                    return (
                        acc + resource.weight * flexibleResources.find((r) => r.specificAsset === resource.type)?.amount
                    );
                }, 0);
            } else if (requiredAssetCategory === 'food') {
                // food has no rarity, so we simply just check if the user has inputted the correct amount of the food.
                // e.g. if the recipe, say, requires 10 of any food, the user can input 5 burgers, 2 candies and 3 juices.
                // we just need to check if the user has inputted 10 food items in total.
                const flexibleFoods = chosenFlexibleRequiredAssets.filter((asset) => asset.assetCategory === 'food');

                const totalFlexibleFoodAmount = flexibleFoods.reduce((acc, food) => {
                    return acc + food.amount;
                }, 0);

                if (totalFlexibleFoodAmount !== requiredAssetAmount) {
                    console.log(`(craftAsset) User didn't input the correct amount of food`);

                    allFlexibleRequiredAssetsOwned = false;
                    break;
                }

                // if the user has inputted the correct amount of the flexible foods, we need to deduct the amount from the `remainingFlexibleRequiredAssets` array.
                remainingFlexibleRequiredAssets.find((asset) => asset.assetCategory === 'food').amount -=
                    requiredAssetAmount;

                // if the amount of the flexible food is 0, remove it from the array.
                if (remainingFlexibleRequiredAssets.find((asset) => asset.assetCategory === 'food').amount === 0) {
                    remainingFlexibleRequiredAssets.splice(
                        remainingFlexibleRequiredAssets.findIndex((asset) => asset.assetCategory === 'food'),
                        1
                    );
                }

                // now we just need to check if the user owns the correct amount of the flexible foods.
                // for example, if 5 burgers, 2 candies and 3 juices are inputted,
                // then the user needs to own AT LEAST 5 burgers, 2 candies and 3 juices.
                for (const flexibleFood of flexibleFoods) {
                    const userFood = (user.inventory?.foods as Food[]).find(
                        (food) => food.type === flexibleFood.specificAsset
                    );

                    if (!userFood || userFood.amount < flexibleFood.amount) {
                        console.log(
                            `(craftAsset) User doesn't own the correct amount of ${flexibleFood.specificAsset}`
                        );

                        allFlexibleRequiredAssetsOwned = false;
                        break;
                    }
                }

                // get the total weight to reduce based on the flexible foods
                totalWeightToReduce += flexibleFoods.reduce((acc, food) => {
                    // right now, it's 0 because food doesn't have weight
                    return acc + food.amount * 0;
                }, 0);
            } else if (requiredAssetCategory === 'item') {
                // item has no rarity, so we simply just check if the user has inputted the correct amount of the item.
                // e.g. if the recipe, say, requires 10 of any item, the user can input 5 of item A and 5 of item B.
                // we just need to check if the user has inputted 10 items in total.
                const flexibleItems = chosenFlexibleRequiredAssets.filter((asset) => asset.assetCategory === 'item');

                const totalFlexibleItemAmount = flexibleItems.reduce((acc, item) => {
                    return acc + item.amount;
                }, 0);

                if (totalFlexibleItemAmount !== requiredAssetAmount) {
                    console.log(`(craftAsset) User didn't input the correct amount of items`);

                    allFlexibleRequiredAssetsOwned = false;
                    break;
                }

                // if the user has inputted the correct amount of the flexible items, we need to deduct the amount from the `remainingFlexibleRequiredAssets` array.
                remainingFlexibleRequiredAssets.find((asset) => asset.assetCategory === 'item').amount -=
                    requiredAssetAmount;

                // if the amount of the flexible item is 0, remove it from the array.
                if (remainingFlexibleRequiredAssets.find((asset) => asset.assetCategory === 'item').amount === 0) {
                    remainingFlexibleRequiredAssets.splice(
                        remainingFlexibleRequiredAssets.findIndex((asset) => asset.assetCategory === 'item'),
                        1
                    );
                }

                // now we just need to check if the user owns the correct amount of the flexible items.
                // for example, if 5 of item A and 5 of item B are inputted,
                // then the user needs to own AT LEAST 5 of item A and 5 of item B.
                for (const flexibleItem of flexibleItems) {
                    const userItem = (user.inventory?.items as Item[]).find(
                        (item) => item.type === flexibleItem.specificAsset
                    );

                    if (!userItem || userItem.amount < flexibleItem.amount) {
                        console.log(
                            `(craftAsset) User doesn't own the correct amount of ${flexibleItem.specificAsset}`
                        );

                        allFlexibleRequiredAssetsOwned = false;
                        break;
                    }
                }

                // get the total weight to reduce based on the flexible items
                totalWeightToReduce += flexibleItems.reduce((acc, item) => {
                    // right now, it's 0 because items don't have weight
                    return acc + item.amount * 0;
                }, 0);
            }
        }

        // now, loop through the non-flexible required assets. because non-flexible required assets will require a specific asset,
        // we just need to check if the user owns at least the required amount of the specific asset.
        for (const requiredAsset of requiredAssets) {
            // note: no need to check for rarity because the required asset is always a specific asset.
            const requiredAssetCategory = requiredAsset.assetCategory;
            const requiredAssetType = requiredAsset.specificAsset;
            const requiredAssetAmount = requiredAsset.amount * amount;

            if (requiredAssetCategory === 'resource') {
                const userResource = (user.inventory?.resources as ExtendedResource[]).find(
                    (resource) => resource.type === requiredAssetType
                );

                if (!userResource || userResource.amount < requiredAssetAmount) {
                    console.log(`(craftAsset) User doesn't own the correct amount of ${requiredAssetType}`);

                    allRequiredAssetsOwned = false;
                    break;
                }

                // get the total weight to reduce based on the non-flexible resources
                totalWeightToReduce +=
                    resources.find((resource) => resource.type === requiredAssetType)?.weight * requiredAssetAmount;
            } else if (requiredAssetCategory === 'food') {
                const userFood = (user.inventory?.foods as Food[]).find((food) => food.type === requiredAssetType);

                if (!userFood || userFood.amount < requiredAssetAmount) {
                    console.log(`(craftAsset) User doesn't own the correct amount of ${requiredAssetType}`);

                    allRequiredAssetsOwned = false;
                    break;
                }

                // get the total weight to reduce based on the non-flexible foods
                // right now, it's 0 because food doesn't have weight
                totalWeightToReduce += 0;
            } else if (requiredAssetCategory === 'item') {
                const userItem = (user.inventory?.items as Item[]).find((item) => item.type === requiredAssetType);

                if (!userItem || userItem.amount < requiredAssetAmount) {
                    console.log(`(craftAsset) User doesn't own the correct amount of ${requiredAssetType}`);

                    allRequiredAssetsOwned = false;
                    break;
                }

                // get the total weight to reduce based on the non-flexible items
                // right now, it's 0 because items don't have weight
                totalWeightToReduce += 0;
            }
        }

        // check if 1. `allRequiredAssetsOwned` is true and `allFlexibleRequiredAssetsOwned` is true, and 2. `remainingFlexibleRequiredAssets` is empty.
        // if both conditions are met, the function logic continues (meaning that the asset check has passed).
        if (!allRequiredAssetsOwned) {
            console.log(`(craftAsset) allRequiredAssetsOwned check failed.`);

            throw new Error('allRequiredAssetsOwned check failed. Please try again.');
        }

        if (!allFlexibleRequiredAssetsOwned) {
            console.log(`(craftAsset) allFlexibleRequiredAssetsOwned check failed.`);

            throw new Error('allFlexibleRequiredAssetsOwned check failed. Please try again.');
        }

        if (remainingFlexibleRequiredAssets.length > 0) {
            console.log(`(craftAsset) remainingFlexibleRequiredAssets check failed.`);
            console.log(
                `remainingFlexibleRequiredAssets data: ${JSON.stringify(remainingFlexibleRequiredAssets, null, 2)}`
            );

            throw new Error('remainingFlexibleRequiredAssets check failed. Please try again');
        }

        //// TO DO: USER COMPENSATION FOR FAILED CRAFTS (check logic with team)
        // FOR EACH `amount` (NOT successfulCrafts) OF THE ASSET TO CRAFT:
        // 1. if `requiredXCookies` > 0, deduct the required xCookies from the user's inventory.
        // 2. if `obtainedPoints` > 0, increase the user's points in the leaderboard, also potentially add the points to the user's
        // squad's total points (if they are in a squad).
        // 3. reduce the energy of the user by the `energyRequired` of the recipe.
        // 4. reduce the user's inventory weight by the `weight` of the recipe.
        // 5. remove the assets used to craft the asset from the user's inventory.

        // do task 1.
        if (craftingRecipe.requiredXCookies > 0) {
            userUpdateOperations.$inc[`inventory.xCookieData.currentXCookies`] =
                -craftingRecipe.requiredXCookies * amount;
        }

        // do task 3.
        // reduce the user's energy
        userUpdateOperations.$inc[`inGameData.energy.currentEnergy`] = -energyRequired;

        // do task 5.
        // remove the assets used to craft the asset.
        // to do this, we will loop through 1. the `requiredAssets` array and 2. the `chosenFlexibleRequiredAssets` array.
        // for each required asset, we will deduct the amount from the user's inventory.
        // for each flexible required asset, we will deduct the amount from the user's inventory.
        const batchDeductResult = await batchDeductFromInventory(
            user._id,
            [
                ...requiredAssets.map(({ amount, specificAsset }) => ({ asset: specificAsset, amount })),
                ...chosenFlexibleRequiredAssets.map(({ amount, specificAsset }) => ({ asset: specificAsset, amount })),
            ],
            session
        );

        if (batchDeductResult.status !== Status.SUCCESS) {
            throw new Error(batchDeductResult.message);
        }

        console.log(`(craftAsset) User update operations: ${JSON.stringify(userUpdateOperations, null, 2)}`);

        // update the user's inventory, leaderboard, squad and squad leaderboard.
        // divide $set and $inc, then $push and pull.
        await UserModel.updateOne(
            { twitterId },
            {
                $set: userUpdateOperations.$set,
                $inc: userUpdateOperations.$inc,
            },
            { session }
        ),
            await UserModel.updateOne(
                { twitterId },
                {
                    $push: userUpdateOperations.$push,
                    $pull: userUpdateOperations.$pull,
                },
                { session }
            );

        // create a new ongoing craft instance in the database.
        const newCraftingQueue = new CraftingQueueModel({
            _id: generateObjectId(),
            userId: user._id,
            status: CraftingQueueStatus.ONGOING,
            craftingRecipeLine: craftingRecipe.craftingRecipeLine,
            craftedAssetData: {
                asset: assetToCraft,
                amount: amount,
                assetType: craftingRecipe.craftedAssetData.assetType,
                totalWeight: craftingRecipe.weight * amount,
                assetRarity: craftingRecipe.craftedAssetData.assetRarity,
            },
            assetsUsed: {
                // for each required asset, we need to multiply the amount by the `amount` parameter.
                // this is because the true amount of the required asset used depends on the `amount` that the user wants to craft.
                // chosenFlexibleRequiredAssets already has the correct amount because it's required from the FE and is double checked, while requiredAssets manually check for it and not update it automatically.
                requiredAssets: requiredAssets.map((asset) => ({ ...asset, amount: asset.amount * amount })),
                chosenFlexibleRequiredAssets,
            },
            claimData: {
                claimableAmount: 0,
                claimedAmount: 0,
            },
            craftingStart: Math.floor(Date.now() / 1000),
            // craftingEnd should only take into account the amount of successfulCrafts, not the base `amount`.
            // e.g. if a user successfully crafts 5 out of 10 of the asset, the craftingEnd should be the base crafting duration * 5.
            craftingEnd: Math.floor(Date.now() / 1000) + craftingRecipe.craftingDuration * amount,
        });

        await newCraftingQueue.save({ session });

        // for each `amount` being crafted, create a new `completeCraft` task in the queue to increment the `claimData.claimableAmount` by 1 each time the queue is completed.
        // for example, if the user crafts 10 of asset A and each craft takes 1 minute, 10 queues will be created, each with a 1 minute delay. each time the queue is completed, the `claimData.claimableAmount` will be incremented by 1.
        // queue 1 will be completed after 1 minute, queue 2 after 2 minutes, and so on.
        for (let i = 0; i < amount; i++) {
            CRAFT_QUEUE.add(
                'completeCraft',
                {
                    craftingQueueId: newCraftingQueue._id,
                },
                { delay: craftingRecipe.craftingDuration * 1000 * (i + 1) }
            );
        }

        console.log(`(craftAsset) Added ${amount}x ${assetToCraft} to the crafting queue.`);

        // commit the transaction only if this function started it
        if (!_session) {
            await session.commitTransaction();
            session.endSession();
        }

        return {
            status: Status.SUCCESS,
            message: `(craftAsset) Added ${amount}x ${assetToCraft} to the crafting queue.`,
            data: {
                craftingQueue: newCraftingQueue,
                energyConsumed: energyRequired,
                poi: user.inGameData.location,
            },
        };
    } catch (err: any) {
        // abort the transaction if an error occurs
        if (!_session) {
            await session.abortTransaction();
            session.endSession();
        }

        console.error(`(craftAsset) ${err.message}`);

        return {
            status: Status.ERROR,
            message: `(craftAsset) ${err.message}`,
        };
    }
};

/**
 * Fetches the last 100 crafting queues of a user.
 */
export const fetchCraftingQueues = async (userId: string): Promise<ReturnValue> => {
    try {
        const craftingQueues = await CraftingQueueModel.find({ userId }).sort({ craftingStart: -1 }).limit(100).lean();

        return {
            status: Status.SUCCESS,
            message: `(fetchCraftingQueues) Fetched crafting queues.`,
            data: {
                ongoingCraftingQueues:
                    craftingQueues.filter((queue) => queue.status === CraftingQueueStatus.ONGOING) ?? null,
                // note: because `PARTIALLY_CANCELLED_CLAIMABLE` also include claimable assets, we need to include them in the claimableCraftingQueues array.
                claimableCraftingQueues:
                    craftingQueues.filter(
                        (queue) =>
                            queue.status === CraftingQueueStatus.CLAIMABLE ||
                            queue.status === CraftingQueueStatus.PARTIALLY_CANCELLED_CLAIMABLE
                    ) ?? null,
                claimedCraftingQueues:
                    craftingQueues.filter((queue) => queue.status === CraftingQueueStatus.CLAIMED) ?? null,
                cancelledCraftingQueues:
                    craftingQueues.filter((queue) => queue.status === CraftingQueueStatus.CANCELLED) ?? null,
                partiallyCancelledCraftingQueues:
                    craftingQueues.filter((queue) => queue.status === CraftingQueueStatus.PARTIALLY_CANCELLED) ?? null,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(fetchCraftingQueues) ${err.message}`,
        };
    }
};

/**
 * Cancels a crafting queue. Only available when the asset(s) in the queue is/are still being crafted and not claimable yet.
 *
 * Will cost xCookies. Energy will NOT be refunded.
 */
export const cancelCraft = async (twitterId: string, craftingQueueId: string): Promise<ReturnValue> => {
    try {
        // get all current queues
        const currentQueues = await CRAFT_QUEUE.getJobs(['waiting', 'active', 'delayed']);

        // find the queue(s) that matches the craftingQueueId
        // note that because there can be multiple queues for a CraftingQueue instance based on the amount being crafted, we need to filter the queues.
        const queuesToRemove = currentQueues.filter((queue) => queue.data.craftingQueueId === craftingQueueId);

        console.log(`(cancelCraft) queuesToRemove: ${JSON.stringify(queuesToRemove, null, 2)}`);

        if (!queuesToRemove || queuesToRemove.length === 0) {
            return {
                status: Status.ERROR,
                message: `(cancelCraft) Crafting queue(s) in Bull not found.`,
            };
        }

        // get the user data
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(cancelCraft) User not found.`,
            };
        }

        // get the crafting queue data
        const craftingQueue = await CraftingQueueModel.findOne({ _id: craftingQueueId }).lean();

        if (!craftingQueue) {
            return {
                status: Status.ERROR,
                message: `(cancelCraft) Crafting queue not found.`,
            };
        }

        const rarity =
            CRAFTING_RECIPES.find((recipe) => recipe.craftedAssetData.asset === craftingQueue.craftedAssetData.asset)
                ?.craftedAssetData.assetRarity ?? null;

        if (!rarity) {
            return {
                status: Status.ERROR,
                message: `(cancelCraft) Asset rarity not found.`,
            };
        }

        // check if the user has the xCookies required to remove the queue
        // in order to get the final amount, we need to check how many of the asset is being crafted (by checking how many queues are left in Bull)
        // for instance, say the user crafts 10 of the asset, and already has claimed 6. then, the user will need to pay the xCookies required to cancel 4 of the asset.
        const xCookiesRequired = CANCEL_CRAFT_X_COOKIES_COST(rarity) * queuesToRemove.length;

        if (user.inventory.xCookieData.currentXCookies < xCookiesRequired) {
            return {
                status: Status.ERROR,
                message: `(cancelCraft) User does not have enough xCookies to cancel the crafting queue.`,
            };
        }

        const userUpdateOperations = {
            $inc: {},
            $pull: {},
            $set: {},
            $push: {},
        };

        // 1. reduce the user's xCookies
        // 2. refund the assets used to craft the asset
        // 3. remove the crafting queue from the database
        // 4. update the crafting queue status to `CANCELLED`
        // NOTE: energy will NOT be refunded.
        userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = -xCookiesRequired;

        // refund the assets
        const { requiredAssets, chosenFlexibleRequiredAssets } = craftingQueue.assetsUsed;

        // initialize $each on the user's inventory items, foods and/or resources.
        if (!userUpdateOperations.$push['inventory.items']) {
            userUpdateOperations.$push['inventory.items'] = { $each: [] };
        }

        if (!userUpdateOperations.$push['inventory.foods']) {
            userUpdateOperations.$push['inventory.foods'] = { $each: [] };
        }

        if (!userUpdateOperations.$push['inventory.resources']) {
            userUpdateOperations.$push['inventory.resources'] = { $each: [] };
        }

        // combine the required assets and the chosen flexible required assets
        const allRequiredAssets = [...requiredAssets, ...chosenFlexibleRequiredAssets];

        // calculate the total weight to increase for the user's inventory
        let totalWeightToIncrease = 0;

        for (const asset of allRequiredAssets) {
            console.log(`(cancelCraft) asset: ${JSON.stringify(asset, null, 2)}`);

            const requiredAssetCategory = asset.assetCategory;
            const requiredAssetType = asset.specificAsset;

            // note that `requiredAssetAmount` needs to take into account the following:
            // the base `asset.amount` is the total amount of this asset required to craft `craftedAssetData.amount` of the asset.
            // let's say that the user has crafted 10 of an asset, i.e. `craftedAssetData.amount` = 10.
            // the user has claimed 5 of this asset, i.e. `claimData.claimedAmount` = 5, and currently there is 1 claimable instance, i.e.`claimData.claimableAmount` = 1.
            // this means that so far, 6 of the 10 assets have been produced, meaning that the user will only be refunded for the remaining 4 assets.
            // to calculate the refundable amount, we need to subtract the claimed amount and the claimable amount (i.e. produced) from the crafted amount, and then divide it by the crafted amount, then multiply it by the `asset.amount`.
            const refundableAmount =
                ((craftingQueue.craftedAssetData.amount -
                    craftingQueue.claimData.claimedAmount -
                    craftingQueue.claimData.claimableAmount) /
                    craftingQueue.craftedAssetData.amount) *
                asset.amount;

            if (requiredAssetCategory === 'resource') {
                const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(
                    (resource) => resource.type === requiredAssetType
                );

                console.log(`(cancelCraft) resourceIndex: ${resourceIndex}`);

                if (resourceIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = refundableAmount;
                    // if not found, create a new entry
                } else {
                    const resource = resources.find((resource) => resource.type === requiredAssetType);
                    userUpdateOperations.$push['inventory.resources'].$each.push({
                        ...resource,
                        amount: refundableAmount,
                        origin: ExtendedResourceOrigin.NORMAL,
                        mintableAmount: 0,
                    });
                }

                // calculate the weight to increase
                totalWeightToIncrease +=
                    refundableAmount * resources.find((resource) => resource.type === requiredAssetType).weight;
            } else if (requiredAssetCategory === 'food') {
                const foodIndex = (user.inventory?.foods as Food[]).findIndex(
                    (food) => food.type === requiredAssetType
                );

                if (foodIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = refundableAmount;
                    // if not found, create a new entry
                } else {
                    userUpdateOperations.$push['inventory.foods'].$each.push({
                        type: requiredAssetType,
                        amount: refundableAmount,
                        mintableAmount: 0,
                    });
                }

                // calculate the weight to increase
                // for now, food has no weight, so put 0
                totalWeightToIncrease += refundableAmount * 0;
            } else if (requiredAssetCategory === 'item') {
                const itemIndex = (user.inventory?.items as Item[]).findIndex(
                    (item) => item.type === requiredAssetType
                );

                if (itemIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = refundableAmount;
                    // if not found, create a new entry
                } else {
                    userUpdateOperations.$push['inventory.items'].$each.push({
                        type: requiredAssetType,
                        amount: refundableAmount,
                        totalAmountConsumed: 0,
                        weeklyAmountConsumed: 0,
                        mintableAmount: 0,
                    });
                }

                // calculate the weight to increase
                // for now, items have no weight, so put 0
                totalWeightToIncrease += refundableAmount * 0;
            }
        }

        // increase the user's weight
        userUpdateOperations.$inc['inventory.weight'] = totalWeightToIncrease;

        // remove all crafting queues from Bull
        await Promise.all(queuesToRemove.map((queue) => queue.remove()));

        console.log(`(cancelCraft) User update operations: ${JSON.stringify(userUpdateOperations, null, 2)}`);

        // do the operations (divide into $set and $inc, then $push and $pull)
        await Promise.all([
            UserModel.updateOne(
                { twitterId },
                {
                    $set: userUpdateOperations.$set,
                    $inc: userUpdateOperations.$inc,
                }
            ),
            CraftingQueueModel.updateOne(
                { _id: craftingQueueId },
                {
                    $set: {
                        // if some assets have been produced (i.e. claimableAmount + claimedAmount > 0), check the following:
                        // 1. if claimableAmount > 0, set to `PARTIALLY_CANCELLED_CLAIMABLE`.
                        // 2. if claimableAmount === 0, set to `PARTIALLY_CANCELLED`.
                        // if no assets have been produced, set to `CANCELLED`.
                        status:
                            craftingQueue.claimData.claimableAmount + craftingQueue.claimData.claimedAmount > 0
                                ? craftingQueue.claimData.claimableAmount > 0
                                    ? CraftingQueueStatus.PARTIALLY_CANCELLED_CLAIMABLE
                                    : CraftingQueueStatus.PARTIALLY_CANCELLED
                                : CraftingQueueStatus.CANCELLED,
                    },
                }
            ),
        ]);

        await UserModel.updateOne(
            { twitterId },
            {
                $push: userUpdateOperations.$push,
                $pull: userUpdateOperations.$pull,
            }
        );

        return {
            status: Status.SUCCESS,
            message: `(cancelCraft) Successfully cancelled the crafting queue. Assets have been refunded.`,
            data: {
                craftedAsset: craftingQueue.craftedAssetData.asset,
                cancelledAmount:
                    craftingQueue.craftedAssetData.amount -
                    craftingQueue.claimData.claimedAmount -
                    craftingQueue.claimData.claimableAmount,
                cancelledCost: xCookiesRequired,
                requiredAssetsPerQuantity: allRequiredAssets,
                poi: user.inGameData.location,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(cancelCraft) ${err.message}`,
        };
    }
};

/**
 * Complete single crafting asset in the queue
 */
export const completeCraft = async (queueId: string, _session?: ClientSession) => {
    const session = _session ?? (await TEST_CONNECTION.startSession());
    if (!_session) session.startTransaction();

    try {
        const queue = await CraftingQueueModel.findById(queueId);
        if (!queue) {
            throw new Error('Queue not found');
        }

        const user = await UserModel.findById(queue.userId);
        if (!user) {
            throw new Error('User not found.');
        }

        const { craftingRecipeLine } = queue;
        const { assetRarity } = queue.craftedAssetData;
        const masteryData =
            (user.inGameData.mastery?.crafting?.[craftingRecipeLine.toLowerCase()] as CraftingMasteryStats) ?? null;

        const claimableAmount = 1;

        // the amount of successful craft
        const successfulAmount = rollCraftingChance(
            craftingRecipeLine as CraftingRecipeLine,
            assetRarity,
            masteryData?.level || 1,
            claimableAmount
        );

        // get the bonus crafted result by rolling the successful craft result amount
        const criticalAmount = rollCriticalChance(
            craftingRecipeLine as CraftingRecipeLine,
            masteryData?.level || 1,
            successfulAmount
        );
        const failedAmount = claimableAmount - successfulAmount;

        // the combined asset used to craft
        const assetsUsed = [
            ...queue.assetsUsed.requiredAssets,
            ...queue.assetsUsed.chosenFlexibleRequiredAssets,
        ] as CraftingRecipeRequiredAssetData[];

        const refundedMaterial = refundCraftingMaterials(
            assetsUsed.map((asset) => {
                return {
                    assetCategory: asset.assetCategory,
                    requiredRarity: asset.requiredRarity,
                    specificAsset: asset.specificAsset,
                    // calculate the potential refund for each asset:
                    // 1. divide the asset's used amount by the total amount of the crafted asset to determine the per-unit requirement
                    // 2. multiply the value by the failed amount to calculate the refunded material for the failed crafting attempt
                    amount: (asset.amount / queue.craftedAssetData.amount) * failedAmount,
                };
            })
        );

        const weightPerItem = queue.craftedAssetData.totalWeight / queue.craftedAssetData.amount;

        const claimableAssets: CraftingResult[] = [
            {
                asset: queue.craftedAssetData.asset,
                amount: successfulAmount,
                type: CraftingResultType.SUCCESSFUL,
                weight: weightPerItem,
            },
            {
                asset: queue.craftedAssetData.asset,
                amount: failedAmount,
                type: CraftingResultType.FAILED,
                weight: 0,
            },
            {
                asset: queue.craftedAssetData.asset,
                amount: criticalAmount,
                type: CraftingResultType.BONUS,
                weight: weightPerItem,
            },
            ...refundedMaterial.map((material) => {
                let weight = 0;

                if (material.assetCategory === 'resource') {
                    const resource = resources.find(({ type }) => type === material.specificAsset);

                    if (resource) weight = resource.weight;
                }

                return {
                    asset: material.specificAsset,
                    amount: material.amount,
                    type: CraftingResultType.REFUNDED,
                    weight,
                };
            }),
        ].filter(({ amount }) => amount > 0);

        await queue.updateOne({
            $set: {
                craftingResults: combineCraftingResults(claimableAssets, queue.craftingResults as CraftingResult[]),
                status: CraftingQueueStatus.CLAIMABLE,
            },
            $inc: { 'claimData.claimableAmount': 1 },
        });

        // commit the transaction only if this function started it
        if (!_session) {
            await session.commitTransaction();
            session.endSession();
        }

        return {
            status: Status.SUCCESS,
            message: `(completeCraft) Queue completed successfully`,
        };
    } catch (err: any) {
        // abort the transaction if an error occurs
        if (!_session) {
            await session.abortTransaction();
            session.endSession();
        }

        return {
            status: Status.ERROR,
            message: `(completeCraft) ${err.message}`,
        };
    }
};

/**
 * Simulates crafting success for a given number of attempts.
 * Rolls against the crafting success rate for the specified level and rarity.
 *
 * @param line - The crafting profession line (e.g., Craftsman).
 * @param rarity - The rarity of the crafted asset (e.g., Common, Rare).
 * @param level - The crafting mastery level (1-15).
 * @param attempts - The number of times to roll the chance.
 *
 * @returns The total number of successful rolls.
 */
export const rollCraftingChance = (
    line: CraftingRecipeLine,
    rarity: CraftedAssetRarity,
    level: number,
    attempts: number
): number => {
    // Validate level range
    if (level < 1 || level > 15) {
        throw new Error('Crafting level must be between 1 and 15.');
    }

    // get success rates for the given profession and rarity
    const successRates = GET_CRAFTING_SUCCESS_RATE(line, rarity);

    // determine the success rate for the specified level
    const successRate = successRates[level - 1];

    // simulate the crafting attempts
    return Array.from({ length: attempts }, () => Math.random() < successRate).filter((v) => v).length;
};

/**
 * Rolls to determine the number of critical successes for a given number of crafting attempts.
 * Each attempt is compared against the critical success rate for the crafting level.
 *
 * @param line - The crafting profession line (e.g., Craftsman).
 * @param level - The crafting mastery level (1 to 15).
 * @param attempts - The number of crafting attempts to roll for critical success.
 * @returns The total number of critical successes achieved.
 *
 */
export const rollCriticalChance = (line: CraftingRecipeLine, level: number, attempts: number): number => {
    if (attempts === 0) return 0;

    // retrieve the critical success rates for the crafting profession
    const criticalRates = GET_CRAFTING_CRITICAL_RATE(line);

    // ensure the level is valid and retrieve the corresponding critical rate
    const criticalRate = criticalRates[Math.min(level - 1)];

    // Simulate the crafting attempts and count critical successes
    return Array.from({ length: attempts }, () => Math.random() < criticalRate).filter((v) => v).length;
};

/**
 * Update user's profession mastery required XP.
 */
export const updateMasteryRequiredXP = async (userId: string, _session?: ClientSession) => {
    let session = _session ?? (await TEST_CONNECTION.startSession());
    if (!_session) session.startTransaction();

    try {
        const user = await UserModel.findOne({ $or: [{ twitterId: userId }, { _id: userId }] }).session(session);
        if (!user) {
            throw new Error('User not found.');
        }        

        // get user's current mastery and populate the missing profession line
        const currentMastery: CraftingMastery = populateCraftingMastery(user?.inGameData?.mastery?.crafting || {});

        // convert the object into array then map to update the required xp for each profession mastery
        const updatedMastery = Object.fromEntries(
            Object.entries(currentMastery).map(([line, stats]: [string, CraftingMasteryStats]) => [toCamelCase(line), {
                ...stats,
                xpToNextLevel: GET_PROFESSION_REQUIRED_XP(toPascalCase(line) as CraftingRecipeLine, stats.level + 1, currentMastery)
            }])
        ) as CraftingMastery;

        // update whole crafting mastery data
        await user.updateOne(
            {
                $set: {
                    'inGameData.mastery.crafting': updatedMastery
                },
            },
            { session }
        );

        if (!_session) {
            await session.commitTransaction();
        }

        return {
            status: Status.SUCCESS,
            message: `(updateMasteryRequiredXP) Profession mastery required XP updated.`,
        };
    } catch (err: any) {
        if (!_session) {
            await session.abortTransaction();
        }

        return {
            status: Status.ERROR,
            message: `(updateMasteryRequiredXP) ${err.message}`,
        };
    } finally {
        if (!_session) {
            session.endSession();
        }
    }
}

/**
 * Processes the XP gained by the user through crafting activities
 * and handles leveling up if the required XP threshold is met.
 */
export const updateCraftingLevel = async (
    userId: string,
    acquiredXP: Array<{ craftingLine: CraftingRecipeLine | string; xp: number }>,
    _session?: ClientSession
) => {
    let session = _session ?? (await TEST_CONNECTION.startSession());

    if (!_session) session.startTransaction();

    try {
        const user = await UserModel.findOne({ $or: [{ twitterId: userId }, { _id: userId }] }).session(session);
        if (!user) {
            throw new Error('User not found.');
        }

        for (const line of acquiredXP) {
            const craftingLine = toCamelCase(line.craftingLine);
            const currentMastery: CraftingMastery | null = user?.inGameData?.mastery?.crafting || null;
            const currentMasteryStats: CraftingMasteryStats | null = currentMastery
                ? currentMastery[craftingLine] || null
                : null;
            const currentXP = currentMasteryStats?.xp || 0;

            if (currentMasteryStats) {
                // get required xp to the next level
                const requiredXP = GET_PROFESSION_REQUIRED_XP(
                    line.craftingLine as CraftingRecipeLine,
                    currentMasteryStats.level + 1,
                    currentMastery
                );

                await user.updateOne(
                    {
                        $inc: {
                            [`inGameData.mastery.crafting.${craftingLine}.xp`]: line.xp,
                        },
                    },
                    { session }
                );

                // handle level up
                if (currentXP + line.xp >= requiredXP) {
                    // update the targeted crafting mastery
                    await user.updateOne(
                        {
                            $set: {
                                [`inGameData.mastery.crafting.${craftingLine}.level`]: currentMasteryStats.level + 1,
                                // reset xp every time the user level up
                                [`inGameData.mastery.crafting.${craftingLine}.xp`]: currentXP + line.xp - requiredXP,
                            },
                        },
                        { session }
                    );

                    // update all profession required XP
                    await updateMasteryRequiredXP(user._id, session);          
                }
            } else {
                await user.updateOne(
                    {
                        $set: {
                            [`inGameData.mastery.crafting.${craftingLine}`]: {
                                level: 1,
                                xp: line.xp,
                                craftingSlots: BASE_CRAFTING_SLOTS,
                                craftablePerSlot: BASE_CRAFTABLE_PER_SLOT,
                                xpToNextLevel: GET_PROFESSION_REQUIRED_XP(
                                    line.craftingLine as CraftingRecipeLine,
                                    2, // get required xp to get level 2
                                    currentMastery || ({} as Record<CraftingRecipeLine, CraftingMasteryStats>)
                                ),
                            },
                        },
                    },
                    { session }
                );
            }
        }

        if (!_session) {
            await session.commitTransaction();
        }

        return {
            status: Status.SUCCESS,
            message: `(updateCraftingLevel) User's crafting level updated successfully.`,
        };
    } catch (err: any) {
        if (!_session) {
            await session.abortTransaction();
        }

        return {
            status: Status.ERROR,
            message: `(updateCraftingLevel) ${err.message}`,
        };
    } finally {
        if (!_session) {
            session.endSession();
        }
    }
};

/**
 * Manually claim the crafting results from the queue
 */
export const claimCraftedAssets = async (
    twitterId: string,
    claimType: string,
    craftingLine: CraftingRecipeLine,
    craftingQueueIds: string[],
    _session?: ClientSession
) => {
    const session = _session ?? (await TEST_CONNECTION.startSession());
    if (!_session) session.startTransaction();

    try {
        if (!craftingLine) {
            throw new Error('Crafting line must be provided.');
        }

        if (!craftingQueueIds || craftingQueueIds.length === 0) {
            throw new Error('Valid crafting queue IDs must be provided when claiming crafted assets manually');
        }

        const user = await UserModel.findOne({ twitterId }).lean();
        if (!user) {
            throw new Error('User not found.');
        }

        // find all claimable crafting queues for a user given the crafting line (which can be queried under `craftingRecipeLine`)
        // NOTE: `PARTIALLY_CANCELLED_CLAIMABLE` queues also have to be included because the user can still claim the assets before the queue was cancelled.
        const claimableCraftingQueues = await CraftingQueueModel.find({
            userId: user._id,
            craftingRecipeLine: craftingLine,
            status: { $in: [CraftingQueueStatus.CLAIMABLE, CraftingQueueStatus.PARTIALLY_CANCELLED_CLAIMABLE] },
        })
            .sort('craftingStart')
            .lean();

        if (claimableCraftingQueues.length === 0) {
            throw new Error(`No claimable crafted assets found for the chosen line: ${craftingLine}.`);
        }

        // for each crafting line, check if the user is in the right POI. if not, throw an error.
        const requiredPOI = REQUIRED_POI_FOR_CRAFTING_LINE(craftingLine);
        if (user.inGameData.location !== requiredPOI) {
            throw new Error(`User must be in ${requiredPOI} to claim crafted assets of this line.`);
        }

        const craftingQueues = claimableCraftingQueues.filter((queue) => craftingQueueIds.includes(queue._id));

        if (craftingQueues.length !== craftingQueueIds.length) {
            throw new Error(`Valid crafting queue IDs must be provided when claiming crafted assets manually.`);
        }

        // the maximum weight that can be carried in the user's inventory
        let availableWeight = user.inventory.maxWeight - user.inventory.weight;

        // all the crafting results combined from all queues
        const craftingResults = craftingQueues
            .flatMap(({ craftingResults }) => craftingResults)
            .filter(({ amount }) => amount > 0);

        // get the total weight of the assets to claim
        const claimableTotalWeight = craftingResults.reduce((prev, curr) => {
            return prev + (curr.weight * curr.amount);
        }, 0);

        // check if the user's inventory weight + the totalWeight of the assets to claim exceeds the limit
        if (claimableTotalWeight > availableWeight) {
            throw new Error('Claiming the assets will exceed the inventory weight limit.');
        }

        // create an array of promises for each update operation
        const queueUpdateOperations = craftingQueues.map((queue) => {
            const { claimableAmount, claimedAmount } = queue.claimData;
            const newClaimableAmount = claimableAmount - claimableAmount; // reduce claimableAmount by the claimableAmount
            const newClaimedAmount = claimedAmount + claimableAmount; // increase claimedAmount by the claimableAmount

            // determine the new status based on the conditions
            let newStatus: CraftingQueueStatus;

            if (queue.status === CraftingQueueStatus.PARTIALLY_CANCELLED_CLAIMABLE) {
                if (claimableAmount < queue.claimData.claimableAmount) {
                    newStatus = CraftingQueueStatus.PARTIALLY_CANCELLED_CLAIMABLE;
                } else {
                    newStatus = CraftingQueueStatus.PARTIALLY_CANCELLED;
                }
            } else if (newClaimableAmount + newClaimedAmount === queue.craftedAssetData.amount) {
                newStatus = CraftingQueueStatus.CLAIMED;
            } else {
                newStatus = CraftingQueueStatus.ONGOING;
            }

            return CraftingQueueModel.updateOne(
                { _id: queue._id },
                {
                    $inc: {
                        'claimData.claimableAmount': -claimableAmount,
                        'claimData.claimedAmount': claimableAmount,
                    },
                    $set: {
                        status: newStatus,
                        craftingResults: [],
                    },
                },
                { session }
            );
        });

        // create a map to store xp by crafting line
        const acquiredXP = new Map<CraftingRecipeLine, number>();
        let obtainedPoints = 0;

        // give the user xp gained from the crafting result
        for (const result of craftingResults) {
            // only give the xp when it's successful, critical is not included
            if (result.type !== CraftingResultType.SUCCESSFUL) continue;

            // get this asset's crafting line
            const craftingRecipe = CRAFTING_RECIPES.find((recipe) => recipe.craftedAssetData.asset === result.asset);

            // ignore if crafting recipe doesn't exist
            if (!craftingRecipe) continue;

            // calculate xp based on amount
            const xpGained = craftingRecipe.earnedXP * result.amount;

            // accumulate xp for the specific crafting line
            if (acquiredXP.has(craftingRecipe.craftingRecipeLine)) {
                acquiredXP.set(
                    craftingRecipe.craftingRecipeLine,
                    acquiredXP.get(craftingRecipe.craftingRecipeLine)! + xpGained
                );
            } else {
                acquiredXP.set(craftingRecipe.craftingRecipeLine, xpGained);
            }

            // increment the obtained points
            obtainedPoints += craftingRecipe.obtainedPoints;
        }

        // reward the user points if there's any
        if (obtainedPoints > 0) {
            await addPoints(
                user._id,
                {
                    points: obtainedPoints,
                    source: PointsSource.CRAFTING_RECIPES,
                },
                session
            );
        }

        console.log('craftingResults', craftingResults);
        console.log('acquiredXP', acquiredXP);
        console.log('craftingResults', craftingResults.filter(({ type }) => type !== CraftingResultType.FAILED).map((result) => ({ asset: result.asset, amount: result.amount })));
        

        // add the crafted result and refunded material to the user
        await batchAddToInventory(
            user._id,
            craftingResults.filter(({ type }) => type !== CraftingResultType.FAILED).map((result) => ({ asset: result.asset, amount: result.amount })),
            session
        );

        // increment user's mastery xp
        const levelResult = await updateCraftingLevel(
            user._id,
            Array.from(acquiredXP, ([craftingLine, xp]) => ({ craftingLine, xp })),
            session
        );

        if (levelResult.status !== Status.SUCCESS) {
            throw new Error(levelResult.message);
        }

        // update queues status and clear the crafting results
        await Promise.all(queueUpdateOperations);

        // commit the transaction only if this function started it
        if (!_session) {
            await session.commitTransaction();
        }

        return {
            status: Status.SUCCESS,
            message: `(claimCraftedAssets) Successfully claimed claimable crafted assets.`,
            data: {
                craftingResults,
                poi: user.inGameData.location,
            },
        };
    } catch (err: any) {
        // abort the transaction if an error occurs
        if (!_session) {
            await session.abortTransaction();
        }

        return {
            status: Status.ERROR,
            message: `(addItem) ${err.message}`,
        };
    } finally {
        if (!_session) {
            session.endSession();
        }
    }
};

/**
 * Refund 50% of the crafting materials.
 * Randomly selects which resources to refund in cases of rounding.
 * @param materials - Array of crafting recipe required asset data.
 * @returns Array of refunded crafting materials.
 */
export const refundCraftingMaterials = (
    materials: CraftingRecipeRequiredAssetData[]
): CraftingRecipeRequiredAssetData[] => {
    if (materials.length === 0) return [];

    // flatten all materials into individual units using flatMap
    const allResources: CraftingRecipeRequiredAssetData[] = materials.flatMap((material) =>
        Array(material.amount).fill({
            assetCategory: material.assetCategory,
            specificAsset: material.specificAsset,
            requiredRarity: material.requiredRarity,
            amount: 1,
        })
    );

    // calculate the number of resources to refund (50% rounded up)
    const totalToRefund = Math.ceil(allResources.length / 2);

    // randomly select resources to refund
    const refundedResources: CraftingRecipeRequiredAssetData[] = [];
    while (refundedResources.length < totalToRefund && allResources.length > 0) {
        const randomIndex = Math.floor(Math.random() * allResources.length);
        refundedResources.push(allResources.splice(randomIndex, 1)[0]);
    }

    // aggregate refunded resources back into material objects
    const refundSummary: Record<string, CraftingRecipeRequiredAssetData> = {};
    refundedResources.forEach((resource) => {
        const key = `${resource.assetCategory}-${resource.specificAsset}-${resource.requiredRarity}`;
        if (!refundSummary[key]) {
            refundSummary[key] = {
                assetCategory: resource.assetCategory,
                specificAsset: resource.specificAsset,
                requiredRarity: resource.requiredRarity,
                amount: 0,
            };
        }
        refundSummary[key].amount += 1;
    });

    return Object.values(refundSummary);
};

/**
 * Combine two arrays of CraftingResult, incrementing amount for matching asset and type.
 * @param array1 First array of CraftingResult.
 * @param array2 Second array of CraftingResult.
 * @returns A new array combining both, with amounts incremented where asset and type match.
 */
export const combineCraftingResults = (array1: CraftingResult[], array2: CraftingResult[]): CraftingResult[] => {
    const combinedMap = new Map<string, CraftingResult>();

    // add results from the first array to the map
    array1.forEach((result) => {
        const key = `${result.asset}-${result.type}`;
        combinedMap.set(key, { ...result });
    });

    // process the second array and update the map
    array2.forEach((result) => {
        const key = `${result.asset}-${result.type}`;
        if (combinedMap.has(key)) {
            // increment the amount if it exists
            const existing = combinedMap.get(key)!;
            existing.amount += result.amount;
        } else {
            // add new entry if no match exists
            combinedMap.set(key, { ...result });
        }
    });

    // convert the map back to an array
    return Array.from(combinedMap.values());
};

/**
 * Function to populate missing recipe lines with default values
 */
export const populateCraftingMastery = (mastery: Partial<CraftingMastery>): CraftingMastery => {
    // create a new CraftingMastery object with all recipe lines
    const completeMastery: CraftingMastery = Object.values(CraftingRecipeLine).reduce((acc, line) => {
        acc[toCamelCase(line)] = mastery[toCamelCase(line)] || {
            level: 1,
            xp: 0,
            xpToNextLevel: GET_PROFESSION_REQUIRED_XP(line, 2, mastery as CraftingMastery),
            craftingSlots: BASE_CRAFTING_SLOTS,
            craftablePerSlot: BASE_CRAFTABLE_PER_SLOT,
        }; // Use existing stats or default
        return acc;
    }, {} as CraftingMastery);

    return completeMastery;
};
