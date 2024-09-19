import { AssetType } from '../models/asset';
import { CraftableAsset, CraftingRecipe, CraftingRecipeRequiredAssetData, CraftingQueueStatus, CraftedAssetData } from "../models/craft";
import { Food } from '../models/food';
import { Item, RestorationItem } from '../models/item';
import { LeaderboardPointsSource, LeaderboardUserData } from '../models/leaderboard';
import { BarrenResource, ExtendedResource, ExtendedResourceOrigin, FruitResource, LiquidResource, OreResource, ResourceType, SimplifiedResource } from "../models/resource";
import { CRAFT_QUEUE, CRAFTING_RECIPES, GET_CRAFTING_LEVEL } from '../utils/constants/craft';
import { LeaderboardModel, CraftingQueueModel, SquadLeaderboardModel, SquadModel, UserModel } from "../utils/constants/db";
import { CARPENTING_MASTERY_LEVEL, COOKING_MASTERY_LEVEL, SMELTING_MASTERY_LEVEL, TAILORING_MASTERY_LEVEL } from "../utils/constants/mastery";
import { getResource, getResourceWeight, resources } from "../utils/constants/resource";
import { GET_SEASON_0_PLAYER_LEVEL, GET_SEASON_0_PLAYER_LEVEL_REWARDS } from '../utils/constants/user';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from "../utils/retVal";

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
        asset: AssetType,
        assetCategory: 'resource' | 'food' | 'item',
        amount: number,
    }>
): Promise<ReturnValue> => {
    // get the asset data from `CRAFTING_RECIPES` by querying the craftedAssetData.asset
    const craftingRecipe = CRAFTING_RECIPES.find(recipe => recipe.craftedAssetData.asset === assetToCraft);

    console.log('(craftAsset), chosenFlexibleRequiredAssets: ', JSON.stringify(chosenFlexibleRequiredAssets, null, 2));

    if (!craftingRecipe) {
        console.log(`(craftAsset) Crafting recipe not found.`);

        return {
            status: Status.ERROR,
            message: `(craftAsset) Crafting recipe not found.`
        }
    }

    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            console.log(`(craftAsset) User not found.`);

            return {
                status: Status.ERROR,
                message: `(craftAsset) User not found.`
            }
        }

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const leaderboardUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const squadUpdateOperations = {
            squadId: user.inGameData.squadId ?? null,
            updateOperations: {
                $pull: {},
                $inc: {},
                $set: {},
                $push: {}
            }
        }

        const squadLeaderboardUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        // used only for updating the squad leaderboard if needed.
        let squadLeaderboardWeek = 0;

        // check if the user has enough energy to craft the asset
        const energyRequired = craftingRecipe.baseEnergyRequired * amount;

        if (user.inGameData.energy.currentEnergy < energyRequired) {
            console.log(`(craftAsset) Not enough energy to craft ${amount}x ${assetToCraft}.`);

            return {
                status: Status.ERROR,
                message: `(craftAsset) Not enough energy to craft ${amount}x ${assetToCraft}.`
            }
        }

        // if `requiredXCookies` > 0, check if the user has enough xCookies to craft the asset
        if (craftingRecipe.requiredXCookies > 0) {
            if (user.inventory?.xCookieData.currentXCookies < craftingRecipe.requiredXCookies) {
                console.log(`(craftAsset) Not enough xCookies to craft ${amount}x ${assetToCraft}.`);

                return {
                    status: Status.ERROR,
                    message: `(craftAsset) Not enough xCookies to craft ${amount}x ${assetToCraft}.`
                }
            }
        }

        // if `requiredLevel` !== none, check if the user has the required level to craft the asset
        if (craftingRecipe.requiredLevel !== 'none') {
            if (user.inGameData.level < craftingRecipe.requiredLevel) {
                console.log(`(craftAsset) User level too low to craft ${assetToCraft}.`);

                return {
                    status: Status.ERROR,
                    message: `(craftAsset) User level too low to craft ${assetToCraft}.`
                }
            }
        }

        // if `requiredCraftingLevel` !== none, check if the user has the required crafting level to craft the asset (within the line)
        if (craftingRecipe.requiredCraftingLevel !== 'none') {
            // if the required crafting level is 1, then continue. some users might not have the crafting level set up in the schema,
            // so we don't need to worry.
            // only when the required crafting level is above 1 will we need to check if the user has the required crafting level.
            if (craftingRecipe.requiredCraftingLevel > 1) {
                if (user.inGameData.mastery.crafting[craftingRecipe.craftingRecipeLine.toLowerCase()].level < craftingRecipe.requiredCraftingLevel){
                    console.log(`(craftAsset) User crafting level too low to craft ${assetToCraft}.`);
    
                    return {
                        status: Status.ERROR,
                        message: `(craftAsset) User crafting level too low to craft ${assetToCraft}.`
                    }
                }
            }
        }

        // if weight > 0, check if the user's inventory can still hold the crafted asset (x the amount).
        if (craftingRecipe.weight > 0) {
            const userWeight = user.inventory.weight;
            const maxWeight = user.inventory.maxWeight;
            const totalWeight = craftingRecipe.weight * amount;

            if (userWeight + totalWeight > maxWeight) {
                console.log(`(craftAsset) User inventory weight limit exceeded. Cannot craft ${amount}x ${assetToCraft}`);

                return {
                    status: Status.ERROR,
                    message: `(craftAsset) User inventory weight limit exceeded. Cannot craft ${amount}x ${assetToCraft}`
                }
            }
        }

        // check if the user has the required assets to craft the asset (which is also multiplied by the `amount`) based on the `chosenAssetGroup`.
        // if the user doesn't have the required assets, return an error.
        // firstly, check if the recipe has multiple asset groups. if it does, check if the chosenAssetGroup is within the boundary of the length.
        if (
            (craftingRecipe.requiredAssetGroups.length === 1 && chosenAssetGroup > 0) ||
            (craftingRecipe.requiredAssetGroups.length > 1 && chosenAssetGroup > craftingRecipe.requiredAssetGroups.length - 1) ||
            chosenAssetGroup < 0
        ) {
            console.log(`(craftAsset) Chosen asset group out of bounds.`);

            return {
                status: Status.ERROR,
                message: `(craftAsset) Chosen asset group out of bounds.`
            }
        }

        // a boolean to check if the user has all the required assets to craft the asset. if any of the required assets are not owned by the user, this will be set to false.
        let allRequiredAssetsOwned = true;
        // as mentioned in the parameter `chosenFlexibleRequiredAssets`, some recipes may require players to have to manually input the specific assets they want to use to craft the asset.
        // for example, if the recipe requires the player to submit 10 of ANY common resource, the player can, for example:
        // input 1. 2 of common resource A, 2. 3 of common resource B, 3. 3 of common resource C and 4. 2 of common resource D (to make 10 in total).
        // this array will contain all of these flexible assets required, and for each `chosenFlexibleRequiredAsset`, if valid, we will deduct the `amount` of the respective `remainingFlexibleRequiredAsset`.
        // for example, let's use the example above (2 of A, 3 of B, 3 of C and 2 of D). to start with, one of the indexes of `remainingFlexibleRequiredAssets` will require 10 of ANY common resource.
        // after looping through A, the index's amount will be reduced by 2 to become 8. then, after looping through B, it will become 5, and so on.
        // only when `remainingFlexibleRequiredAssets` contain 0 for ALL indexes will the user be considered to have inputted the correct amount of the flexible assets.
        const remainingFlexibleRequiredAssets: CraftingRecipeRequiredAssetData[] = JSON.parse(
            JSON.stringify(
                craftingRecipe.requiredAssetGroups[chosenAssetGroup].requiredAssets.filter(requiredAsset => requiredAsset.specificAsset === 'any')
            )
        );
        // a boolean to check if the user has all the flexible required assets to craft the asset. if any of the flexible required assets are not owned by the user, this will be set to false.
        // `remainingFlexibleRequiredAssets` only checks if the user has inputted the correct amount of the flexible assets.
        // `allFlexibleRequiredAssetsOwned` will check if the user OWNS the correct amount of the flexible assets. if the user doesn't own the correct amount, this will be set to false.
        let allFlexibleRequiredAssetsOwned = true;

        // we need to update each flexible required asset in `remainingFlexibleRequiredAssets` based on the amount of the asset the user wants to craft.
        // for example, when the recipe requires 15 common resources and 5 uncommon resources, if the user wants to craft 3 of the asset, we need to multiply the amount by 3.
        remainingFlexibleRequiredAssets.forEach(asset => {
            asset.amount *= amount;
        })

        // divide into the flexible assets and the non-flexible (i.e. specificAsset !== 'any') assets.
        // unlike `remainingFlexibleRequiredAssets`, we will multiply the amounts manually when we for loop each flexible required asset to check for the user's input.
        const flexibleRequiredAssets = craftingRecipe.requiredAssetGroups[chosenAssetGroup].requiredAssets.filter(requiredAsset => requiredAsset.specificAsset === 'any');
        const requiredAssets = craftingRecipe.requiredAssetGroups[chosenAssetGroup].requiredAssets.filter(requiredAsset => requiredAsset.specificAsset !== 'any');

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
                const flexibleResources = chosenFlexibleRequiredAssets.filter(asset => asset.assetCategory === 'resource');
                console.log(`(craftAsset) flexibleResources: ${JSON.stringify(flexibleResources)}`);
                // fetch the resources data for the flexible resources and filter them by the required rarity.
                const flexibleResourceData = flexibleResources.map(resource => resources.find(r => r.type === resource.asset)).filter(resource => resource?.rarity === requiredAssetRarity);
                console.log(`(craftAsset) flexibleResourceData: ${JSON.stringify(flexibleResourceData)}`);

                if (flexibleResourceData.length === 0) {
                    console.log(`(craftAsset) User didn't input the correct amount of ${requiredAssetRarity} resources (1)`);

                    allFlexibleRequiredAssetsOwned = false;
                    break;
                }

                const totalFlexibleResourceAmount = flexibleResources.reduce((acc, resource) => {
                    // Find the resource in flexibleResourceData
                    const foundResource = flexibleResourceData.find(data => data.type === resource.asset);
                    // Only increment the amount if the resource exists in `flexibleResourceData`
                    if (foundResource) {
                        return acc + resource.amount;
                    }
                    // Return the accumulator unchanged if the resource does not match
                    return acc;
                }, 0);

                if (totalFlexibleResourceAmount !== requiredAssetAmount) {
                    console.log(`(craftAsset) User didn't input the correct amount of ${requiredAssetRarity} resources (2). ${totalFlexibleResourceAmount} === ${requiredAssetAmount}`);

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

                    if (!userResource || userResource.amount < flexibleResources.find(resource => resource.asset === flexibleResource.type)?.amount) {
                        console.log(`(craftAsset) User doesn't own the correct amount of ${flexibleResource.type}`);

                        allFlexibleRequiredAssetsOwned = false;
                        break;
                    }
                }
            } else if (requiredAssetCategory === 'food') {
                // food has no rarity, so we simply just check if the user has inputted the correct amount of the food.
                // e.g. if the recipe, say, requires 10 of any food, the user can input 5 burgers, 2 candies and 3 juices.
                // we just need to check if the user has inputted 10 food items in total.
                const flexibleFoods = chosenFlexibleRequiredAssets.filter(asset => asset.assetCategory === 'food');

                const totalFlexibleFoodAmount = flexibleFoods.reduce((acc, food) => {
                    return acc + food.amount;
                }, 0);

                if (totalFlexibleFoodAmount !== requiredAssetAmount) {
                    console.log(`(craftAsset) User didn't input the correct amount of food`);

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
                    const userFood = (user.inventory?.foods as Food[]).find(food => food.type === flexibleFood.asset);

                    if (!userFood || userFood.amount < flexibleFood.amount) {
                        console.log(`(craftAsset) User doesn't own the correct amount of ${flexibleFood.asset}`);

                        allFlexibleRequiredAssetsOwned = false;
                        break;
                    }
                }
            } else if (requiredAssetCategory === 'item') {
                // item has no rarity, so we simply just check if the user has inputted the correct amount of the item.
                // e.g. if the recipe, say, requires 10 of any item, the user can input 5 of item A and 5 of item B.
                // we just need to check if the user has inputted 10 items in total.
                const flexibleItems = chosenFlexibleRequiredAssets.filter(asset => asset.assetCategory === 'item');

                const totalFlexibleItemAmount = flexibleItems.reduce((acc, item) => {
                    return acc + item.amount;
                }, 0);

                if (totalFlexibleItemAmount !== requiredAssetAmount) {
                    console.log(`(craftAsset) User didn't input the correct amount of items`);

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
                    const userItem = (user.inventory?.items as Item[]).find(item => item.type === flexibleItem.asset);

                    if (!userItem || userItem.amount < flexibleItem.amount) {
                        console.log(`(craftAsset) User doesn't own the correct amount of ${flexibleItem.asset}`);

                        allFlexibleRequiredAssetsOwned = false;
                        break;
                    }
                }
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
                const userResource = (user.inventory?.resources as ExtendedResource[]).find(resource => resource.type === requiredAssetType);

                if (!userResource || userResource.amount < requiredAssetAmount) {
                    console.log(`(craftAsset) User doesn't own the correct amount of ${requiredAssetType}`);

                    allRequiredAssetsOwned = false;
                    break;
                }
            } else if (requiredAssetCategory === 'food') {
                const userFood = (user.inventory?.foods as Food[]).find(food => food.type === requiredAssetType);

                if (!userFood || userFood.amount < requiredAssetAmount) {
                    console.log(`(craftAsset) User doesn't own the correct amount of ${requiredAssetType}`);

                    allRequiredAssetsOwned = false;
                    break;
                }
            } else if (requiredAssetCategory === 'item') {
                const userItem = (user.inventory?.items as Item[]).find(item => item.type === requiredAssetType);

                if (!userItem || userItem.amount < requiredAssetAmount) {
                    console.log(`(craftAsset) User doesn't own the correct amount of ${requiredAssetType}`);

                    allRequiredAssetsOwned = false;
                    break;
                }
            }
        }

        // check if 1. `allRequiredAssetsOwned` is true and `allFlexibleRequiredAssetsOwned` is true, and 2. `remainingFlexibleRequiredAssets` is empty.
        // if both conditions are met, the function logic continues (meaning that the asset check has passed).
        if (!allRequiredAssetsOwned) {
            console.log(`(craftAsset) allRequiredAssetsOwned check failed.`);

            return {
                status: Status.ERROR,
                message: `(craftAsset) allRequiredAssetsOwned check failed. Please try again.`
            }
        }

        if (!allFlexibleRequiredAssetsOwned) {
            console.log(`(craftAsset) allFlexibleRequiredAssetsOwned check failed.`);

            return {
                status: Status.ERROR,
                message: `(craftAsset) allFlexibleRequiredAssetsOwned check failed. Please try again.`
            }
        }

        if (remainingFlexibleRequiredAssets.length > 0) {
            console.log(`(craftAsset) remainingFlexibleRequiredAssets check failed.`);
            console.log(`remainingFlexibleRequiredAssets data: ${JSON.stringify(remainingFlexibleRequiredAssets, null, 2)}`);

            return {
                status: Status.ERROR,
                message: `(craftAsset) remainingFlexibleRequiredAssets check failed. Please try again.`
            }
        }

        // if (!allRequiredAssetsOwned || !allFlexibleRequiredAssetsOwned || remainingFlexibleRequiredAssets.length > 0) {
        //     console.log(`(craftAsset) allRequiredAssetsOwned/allFlexibleRequiredAssetsOwned/remainingFlexibleRequiredAssets checks failed.`);
            
        //     return {
        //         status: Status.ERROR,
        //         message: `(craftAsset) One or more asset checks failed. Please try again.`
        //     }
        // }

        let obtainedAssetCount = 0;

        // at this point, all base checks should pass. proceed with the crafting logic.
        // per each amount of the asset to craft, we will roll the first dice to determine if the user successfully crafts 1 of this asset.
        // for instance, if the user wants to craft 5 (amount = 5) of asset A, we will roll the dice of 0-9999 5 times.
        // any dice that rolls below the `baseSuccessChance` will be considered a success, and the user will obtain 1 of the asset.
        // for instance, if the user rolls 7900, 5500, 3200, 8800, 9100, and the `baseSuccessChance` is 7000 (70%), the user will obtain 2 of the asset instead of 5,
        // because only 2 of the rolls (5500 and 3200) are below 7000 (or 70%).
        const successRolls = [];

        for (let i = 0; i < amount; i++) {
            const roll = Math.floor(Math.random() * 10000);
            successRolls.push(roll);
        }

        // get the amount of successful crafts based on the rolls below the `baseSuccessChance`
        const successfulCrafts = successRolls.length > 0 ? successRolls.filter(roll => roll <= craftingRecipe.baseSuccessChance).length : 0;

        // if successfulCrafts is 0, the user failed to craft the asset. return an error.
        if (successfulCrafts === 0) {
            return {
                status: Status.ERROR,
                message: `(craftAsset) User failed to craft ${amount}x ${assetToCraft}. Rolls: ${successRolls.join(', ')}`
            }
        }

        obtainedAssetCount += successfulCrafts;

        // if successfulCrafts > 0, the user successfully crafted the asset. if baseCritChance > 0, roll another dice to determine if, for each successful craft, the user obtains an extra asset.
        // for instance, if the user successfully crafts 2 of the asset, and the `baseCritChance` is 3000 (30%), we will roll the dice 2 times.
        // if both dices fall below 3000, the user will obtain 4 of the asset instead of 2 (1 extra for each successful craft).
        const critRolls = [];

        // only if baseCritChance > 0, roll the dice for each successful craft
        if (craftingRecipe.baseCritChance > 0) {
            for (let i = 0; i < successfulCrafts; i++) {
                const roll = Math.floor(Math.random() * 10000);
                critRolls.push(roll);
            }

            // get the amount of extra crafts based on the rolls below the `baseCritChance`
            const extraCrafts = critRolls.length > 0 && critRolls.filter(roll => roll <= craftingRecipe.baseCritChance).length;

            obtainedAssetCount += extraCrafts;
        }

        //// TO DO: USER COMPENSATION FOR FAILED CRAFTS (check logic with team)
        // FOR EACH `amount` (NOT successfulCrafts) OF THE ASSET TO CRAFT:
        // 1. if `requiredXCookies` > 0, deduct the required xCookies from the user's inventory.
        // 2. if `obtainedPoints` > 0, increase the user's points in the leaderboard, also potentially add the points to the user's
        // squad's total points (if they are in a squad).
        // 3. increase the player's crafting XP (and potentially level) for the specific crafting line based on the `earnedXP` of the recipe.
        // 4. reduce the energy of the user by the `energyRequired` of the recipe.
        // 5. remove the assets used to craft the asset from the user's inventory.

        // do task 1.
        if (craftingRecipe.requiredXCookies > 0) {
            userUpdateOperations.$inc[`inventory.xCookieData.currentXCookies`] = -craftingRecipe.requiredXCookies * amount;
        }

        // do task 2.
        if (craftingRecipe.obtainedPoints > 0) {
            // check if the user exists in the season 0 leaderboard's `userData` array.
            // if it doesn't, create a new entry. else:
            // check if the source `CRAFTING_RECIPES` exists in the user's points data
            // if it does, increment the points. else, create a new entry.
            // also, if the user is eligible for additional points, add the additional points to the `points`.
            const leaderboard = await LeaderboardModel.findOne({ name: 'Season 0' }).lean();

            if (!leaderboard) {
                console.log(`(craftAsset) Leaderboard not found.`);

                return {
                    status: Status.ERROR,
                    message: `(craftAsset) Leaderboard not found.`
                }
            }

            const userIndex = (leaderboard.userData as LeaderboardUserData[]).findIndex(userData => userData.userId === user._id);

            let additionalPoints = 0;

            const currentLevel = user.inGameData.level;

            // if not found, create a new entry
            if (userIndex === -1) {
                // check if the user is eligible to level up to the next level
                const newLevel = GET_SEASON_0_PLAYER_LEVEL(craftingRecipe.obtainedPoints * amount);

                if (newLevel > currentLevel) {
                    // set the user's `inGameData.level` to the new level
                    userUpdateOperations.$set['inGameData.level'] = newLevel;

                    // add the additional points based on the rewards obtainable
                    additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
                }

                leaderboardUpdateOperations.$push['userData'] = {
                    userId: user._id,
                    username: user.twitterUsername,
                    twitterProfilePicture: user.twitterProfilePicture,
                    pointsData: [
                        {
                            points: craftingRecipe.obtainedPoints * amount,
                            source: LeaderboardPointsSource.CRAFTING_RECIPES
                        },
                        {
                            points: additionalPoints,
                            source: LeaderboardPointsSource.LEVELLING_UP
                        }
                    ]
                }
                // if the user is found, increment the points
            } else {
                // get the user's total leaderboard points
                // this is done by summing up all the points from the `pointsData` array, BUT EXCLUDING SOURCES FROM:
                // 1. LeaderboardPointsSource.LEVELLING_UP
                const totalLeaderboardPoints = leaderboard.userData[userIndex].pointsData.reduce((acc, pointsData) => {
                    if (pointsData.source !== LeaderboardPointsSource.LEVELLING_UP) {
                        return acc + pointsData.points;
                    }

                    return acc;
                }, 0);

                const newLevel = GET_SEASON_0_PLAYER_LEVEL(totalLeaderboardPoints + (craftingRecipe.obtainedPoints * amount));

                if (newLevel > currentLevel) {
                    userUpdateOperations.$set['inGameData.level'] = newLevel;
                    additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
                }

                // get the source index for CRAFTING_RECIPES
                const sourceIndex = leaderboard.userData[userIndex].pointsData.findIndex(pointsData => pointsData.source === LeaderboardPointsSource.KOS_BENEFITS);

                if (sourceIndex !== -1) {
                    leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${sourceIndex}.points`] = craftingRecipe.obtainedPoints * amount;
                } else {
                    leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                        points: craftingRecipe.obtainedPoints * amount,
                        source: LeaderboardPointsSource.CRAFTING_RECIPES
                    }
                }

                if (additionalPoints > 0) {
                    const levellingUpIndex = leaderboard.userData[userIndex].pointsData.findIndex(pointsData => pointsData.source === LeaderboardPointsSource.LEVELLING_UP);

                    if (levellingUpIndex !== -1) {
                        leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${levellingUpIndex}.points`] = additionalPoints;
                    } else {
                        leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                            points: additionalPoints,
                            source: LeaderboardPointsSource.LEVELLING_UP
                        }
                    }
                }
            }

            // if the user also has a squad, add the points to the squad's total points
            if (user.inGameData.squad !== null) {
                // get the squad
                const squad = await SquadModel.findOne({ _id: user.inGameData.squadId }).lean();

                if (!squad) {
                    return {
                        status: Status.ERROR,
                        message: `(claimWeeklyKOSRewards) Squad not found.`
                    }
                }

                const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 }).lean();
                squadLeaderboardWeek = latestSquadLeaderboard.week;

                // add only the points to the squad's total points
                squadUpdateOperations.updateOperations.$inc[`squadPoints`] = craftingRecipe.obtainedPoints * amount;

                // check if the squad exists in the squad leaderboard's `pointsData`. if not, we create a new instance.
                const squadIndex = latestSquadLeaderboard.pointsData.findIndex(data => data.squadId === squad._id);

                if (squadIndex === -1) {
                    squadLeaderboardUpdateOperations.$push['pointsData'] = {
                        squadId: squad._id,
                        squadName: squad.name,
                        memberPoints: [
                            {
                                userId: user._id,
                                username: user.twitterUsername,
                                points: craftingRecipe.obtainedPoints * amount
                            }
                        ]
                    }
                } else {
                    // otherwise, we increment the points for the user in the squad
                    const userIndex = latestSquadLeaderboard.pointsData[squadIndex].memberPoints.findIndex(member => member.userId === user._id);

                    if (userIndex !== -1) {
                        squadLeaderboardUpdateOperations.$inc[`pointsData.${squadIndex}.memberPoints.${userIndex}.points`] = craftingRecipe.obtainedPoints * amount;
                    } else {
                        squadLeaderboardUpdateOperations.$push[`pointsData.${squadIndex}.memberPoints`] = {
                            userId: user._id,
                            username: user.twitterUsername,
                            points: craftingRecipe.obtainedPoints * amount
                        }
                    }
                }
            }
        }

        // do task 3.
        // get the user's current crafting level for the specific crafting line
        const currentCraftingLineData = user?.inGameData?.mastery?.crafting?.[craftingRecipe.craftingRecipeLine.toLowerCase()] ?? null;

        // if current crafting line data exists, update. else, create a new entry.
        if (currentCraftingLineData) {
            console.log(`(craftAsset) currentCraftingLineData: ${JSON.stringify(currentCraftingLineData, null, 2)}`);

            // check, with the obtainedXP, if the user will level up in the crafting line
            const newCraftingLevel = GET_CRAFTING_LEVEL(craftingRecipe.craftingRecipeLine, currentCraftingLineData.xp + (craftingRecipe.earnedXP * amount));

            // set the new XP for the crafting line
            userUpdateOperations.$inc[`inGameData.mastery.crafting.${craftingRecipe.craftingRecipeLine.toLowerCase()}.xp`] = craftingRecipe.earnedXP * amount;

            // if the user will level up, set the new level
            if (newCraftingLevel > currentCraftingLineData.level) {
                userUpdateOperations.$set[`inGameData.mastery.crafting.${craftingRecipe.craftingRecipeLine.toLowerCase()}.level`] = newCraftingLevel;
            }
        // if not found, create a new entry
        } else {
            console.log(`(craftAsset) currentCraftingLineData not found. Creating new entry.`);

            userUpdateOperations.$set[`inGameData.mastery.crafting.${craftingRecipe.craftingRecipeLine.toLowerCase()}`] = {
                level: GET_CRAFTING_LEVEL(craftingRecipe.craftingRecipeLine, craftingRecipe.earnedXP * amount),
                xp: craftingRecipe.earnedXP * amount
            }
        }

        // do task 4.
        // reduce the user's energy
        userUpdateOperations.$inc[`inGameData.energy.currentEnergy`] = -energyRequired;

        // do task 5.
        // remove the assets used to craft the asset.
        // to do this, we will loop through 1. the `requiredAssets` array and 2. the `chosenFlexibleRequiredAssets` array.
        // for each required asset, we will deduct the amount from the user's inventory.
        // for each flexible required asset, we will deduct the amount from the user's inventory.
        for (const requiredAsset of requiredAssets) {
            const requiredAssetCategory = requiredAsset.assetCategory;
            const requiredAssetType = requiredAsset.specificAsset;
            const requiredAssetAmount = requiredAsset.amount * amount;

            if (requiredAssetCategory === 'resource') {
                const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === requiredAssetType);

                if (resourceIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = -requiredAssetAmount;
                // just in case
                } else {
                    console.log(`(craftAsset) Required asset ${requiredAssetType} not found in user's inventory.`);
                
                    return {
                        status: Status.ERROR,
                        message: `(craftAsset) Required asset ${requiredAssetType} not found in user's inventory.`
                    }
                }
            } else if (requiredAssetCategory === 'food') {
                const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === requiredAssetType);

                if (foodIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = -requiredAssetAmount;
                // just in case
                } else {
                    console.log(`(craftAsset) Required asset ${requiredAssetType} not found in user's inventory.`);
                
                    return {
                        status: Status.ERROR,
                        message: `(craftAsset) Required asset ${requiredAssetType} not found in user's inventory.`
                    }
                }
            } else if (requiredAssetCategory === 'item') {
                const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === requiredAssetType);

                if (itemIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = -requiredAssetAmount;
                // just in case
                } else {
                    console.log(`(craftAsset) Required asset ${requiredAssetType} not found in user's inventory.`);
                
                    return {
                        status: Status.ERROR,
                        message: `(craftAsset) Required asset ${requiredAssetType} not found in user's inventory.`
                    }
                }
            }
        }

        // for each flexible required asset, we will deduct the amount from the user's inventory.
        for (const flexibleRequiredAsset of chosenFlexibleRequiredAssets) {
            const flexibleAssetCategory = flexibleRequiredAsset.assetCategory;
            const flexibleAssetType = flexibleRequiredAsset.asset;
            const flexibleAssetAmount = flexibleRequiredAsset.amount;

            if (flexibleAssetCategory === 'resource') {
                const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === flexibleAssetType);

                if (resourceIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = -flexibleAssetAmount;
                // just in case
                } else {
                    console.log(`(craftAsset) Flexible asset ${flexibleAssetType} not found in user's inventory.`);
                
                    return {
                        status: Status.ERROR,
                        message: `(craftAsset) Flexible asset ${flexibleAssetType} not found in user's inventory.`
                    }
                }
            } else if (flexibleAssetCategory === 'food') {
                const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === flexibleAssetType);

                if (foodIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = -flexibleAssetAmount;
                // just in case
                } else {
                    console.log(`(craftAsset) Flexible asset ${flexibleAssetType} not found in user's inventory.`);
                
                    return {
                        status: Status.ERROR,
                        message: `(craftAsset) Flexible asset ${flexibleAssetType} not found in user's inventory.`
                    }
                }
            } else if (flexibleAssetCategory === 'item') {
                const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === flexibleAssetType);

                if (itemIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = -flexibleAssetAmount;
                // just in case
                } else {
                    console.log(`(craftAsset) Flexible asset ${flexibleAssetType} not found in user's inventory.`);
                
                    return {
                        status: Status.ERROR,
                        message: `(craftAsset) Flexible asset ${flexibleAssetType} not found in user's inventory.`
                    }
                }
            }
        }

        // update the user's inventory, leaderboard, squad and squad leaderboard.
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            LeaderboardModel.updateOne({ name: 'Season 0' }, leaderboardUpdateOperations),
            SquadModel.updateOne({ _id: user.inGameData.squadId }, squadUpdateOperations),
            SquadLeaderboardModel.updateOne({ week: squadLeaderboardWeek }, squadLeaderboardUpdateOperations)
        ]);

        // create a new ongoing craft instance in the database.
        const newCraftingQueue = new CraftingQueueModel({
            _id: generateObjectId(),
            userId: user._id,
            status: CraftingQueueStatus.ONGOING,
            craftedAssetData: {
                asset: assetToCraft,
                amount: obtainedAssetCount,
                assetType: craftingRecipe.craftedAssetData.assetType,
                totalWeight: craftingRecipe.weight * obtainedAssetCount
            },
            assetsUsed: {
                requiredAssets,
                chosenFlexibleRequiredAssets
            },
            craftingStart: Math.floor(Date.now() / 1000),
            craftingEnd: Math.floor(Date.now() / 1000) + craftingRecipe.craftingDuration   
        });

        await newCraftingQueue.save();

        // add the ongoing craft to the queue to change the CraftingQueue status to `CLAIMABLE` after the crafting duration has passed.
        CRAFT_QUEUE.add(
            'completeCraft', 
            {
                craftingQueueId: newCraftingQueue._id
            }, 
            { delay: craftingRecipe.craftingDuration * 1000 }
        );

        console.log(`(craftAsset) Added ${obtainedAssetCount}x ${assetToCraft} to the crafting queue.`);

        return {
            status: Status.SUCCESS,
            message: `(craftAsset) Added ${obtainedAssetCount}x ${assetToCraft} to the crafting queue.`
        }
    } catch (err: any) {
        console.error(`(craftAsset) ${err.message}`);

        return {
            status: Status.ERROR,
            message: `(craftAsset) ${err.message}`,
        }
    }
}

/**
 * Fetches the crafting queues of a user.
 */
export const fetchCraftingQueues = async (userId: string): Promise<ReturnValue> => {
    try {
        const craftingQueues = await CraftingQueueModel.find({ userId }).lean();

        return {
            status: Status.SUCCESS,
            message: `(fetchCraftingQueues) Fetched crafting queues.`,
            data: {
                ongoingCraftingQueues: craftingQueues.filter(queue => queue.status === CraftingQueueStatus.ONGOING) ?? null,
                claimableCraftingQueues: craftingQueues.filter(queue => queue.status === CraftingQueueStatus.CLAIMABLE) ?? null,
                claimedCraftingQueues: craftingQueues.filter(queue => queue.status === CraftingQueueStatus.CLAIMED) ?? null,
                cancelledCraftingQueues: craftingQueues.filter(queue => queue.status === CraftingQueueStatus.CANCELLED) ?? null
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(fetchCraftingQueues) ${err.message}`
        }
    
    }
}

/**
 * Claims craftable assets either manually or automatically.
 * 
 * If `claimType` is `auto`, then the function will attempt to claim ALL claimable crafted assets for the user.
 * However, if, for example, the user's inventory exceeds the limit and therefore cannot claim all assets, the function will claim as many as possible.
 * 
 * If `claimType` is `manual`, then the function will only claim the crafted assets with the specified `craftingQueueIds`.
 * If no `craftingQueueIds` are provided, the function will throw an error.
 */
export const claimCraftedAssets = async (
    twitterId: string,
    claimType: 'manual' | 'auto' = 'auto',
    // MUST be provided if `claimType` is 'manual'
    craftingQueueIds?: string[]
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimCraftedAssets) User not found.`
            }
        }

        const claimableCraftingQueues = await CraftingQueueModel.find({ userId: user._id, status: CraftingQueueStatus.CLAIMABLE }).lean();

        if (claimableCraftingQueues.length === 0) {
            return {
                status: Status.ERROR,
                message: `(claimCraftedAssets) No claimable crafted assets found.`
            }
        }

        const userUpdateOperations = {
            $push: {},
            $inc: {},
            $set: {},
            $pull: {}
        }

        const craftingQueueUpdateOperations: Array<{
            queueId: string,
            updateOperations: {
                $set?: {},
                $push?: {},
                $pull?: {},
                $inc?: {}
            }
        }> = [];
        
        const fullyClaimedCraftingQueueIDs: string[] = [];
        const partialClaimedCraftingQueueIDs: string[] = [];

        // initialize $each on the user's inventory items, foods and/or resources.
        if (!userUpdateOperations.$push['inventory.items']) {
            userUpdateOperations.$push['inventory.items'] = { $each: [] }
        }

        if (!userUpdateOperations.$push['inventory.foods']) {
            userUpdateOperations.$push['inventory.foods'] = { $each: [] }
        }

        if (!userUpdateOperations.$push['inventory.resources']) {
            userUpdateOperations.$push['inventory.resources'] = { $each: [] }
        }

        if (claimType === 'manual') {
            // `craftingQueueIds` must be provided if `claimType` is 'manual'
            if (!craftingQueueIds || craftingQueueIds.length === 0) {
                return {
                    status: Status.ERROR,
                    message: `(claimCraftedAssets) Valid crafting queue IDs must be provided when claiming crafted assets manually.`
                }
            }

            // right now, the only limitation is the weight of the assets.
            // if the claimable assets have a totalWeight > 0, we need to check if the user's inventory weight + the totalWeight of the assets to claim exceeds the limit.
            // firstly, we need to check if the provided `craftingQueueIds` are valid.
            // to do this, we will filter the `claimableCraftingQueues` array with the provided `craftingQueueIds`.
            // if the length of the filtered array is not equal to the length of the provided `craftingQueueIds`, then one or more of the provided IDs are invalid. we throw an error.

            const filteredClaimableCraftingQueues = claimableCraftingQueues.filter(queue => craftingQueueIds.includes(queue._id));

            if (filteredClaimableCraftingQueues.length !== craftingQueueIds.length) {
                return {
                    status: Status.ERROR,
                    message: `(claimCraftedAssets) One or more of the provided crafting queue IDs are invalid.`
                }
            }

            // get the total weight of the assets to claim
            const finalizedTotalWeight = filteredClaimableCraftingQueues.reduce((acc, queue) => {
                return acc + queue.craftedAssetData.totalWeight;
            }, 0);

            // check if the user's inventory weight + the totalWeight of the assets to claim exceeds the limit
            if (user.inventory.weight + finalizedTotalWeight > user.inventory.maxWeight) {
                return {
                    status: Status.ERROR,
                    message: `(claimCraftedAssets) Claiming the assets will exceed the inventory weight limit.`
                }
            }

            // claim the assets
            for (const queue of filteredClaimableCraftingQueues) {
                const { asset, amount, assetType, totalWeight } = queue.craftedAssetData;

                if (assetType === 'item') {
                    // check if the user owns this asset in their inventory
                    const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === asset);

                    // if not found, add the item to the user's inventory (along with the amount). if found, increment the amount.
                    if (itemIndex === -1) {
                        userUpdateOperations.$push['inventory.items'].$each.push({
                            type: asset,
                            amount,
                            totalAmountConsumed: 0,
                            weeklyAmountConsumed: 0
                        })
                    } else {
                        userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = amount;
                    }
                } else if (assetType === 'food') {
                    // check if the user owns the food in their inventory
                    const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === asset);

                    // if not found, add the food to the user's inventory (along with the amount). if found, increment the amount.
                    if (foodIndex === -1) {
                        userUpdateOperations.$push['inventory.foods'].$each.push({
                            type: asset,
                            amount
                        })
                    } else {
                        userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = amount;
                    }
                } else if (assetType === 'resource') {
                    // get the resource data.
                    const resourceData = resources.find(resource => resource.type === asset);

                    if (!resourceData) {
                        return {
                            status: Status.ERROR,
                            message: `(claimCraftedAssets) Resource data not found for ${asset}.`
                        }
                    }

                    // check if the user owns the resource in their inventory
                    const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === asset);

                    // if not found, add the resource to the user's inventory (along with the amount). if found, increment the amount.
                    if (resourceIndex === -1) {
                        userUpdateOperations.$push['inventory.resources'].$each.push({
                            ...resourceData,
                            amount,
                            origin: ExtendedResourceOrigin.NORMAL
                        })
                    } else {
                        userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = amount;
                    }
                }

                // add the crafting queue ID to the fullyClaimedCraftingQueueIDs array
                fullyClaimedCraftingQueueIDs.push(queue._id);

                // update the crafting queue status to `CLAIMED`
                craftingQueueUpdateOperations.push({
                    queueId: queue._id,
                    updateOperations: {
                        $set: {
                            status: CraftingQueueStatus.CLAIMED
                        }
                    }
                });

                // increase the user's weight
                userUpdateOperations.$inc['inventory.weight'] = finalizedTotalWeight;
            }
        // if auto, we need to do the following:
        // 1. check if ALL claimable assets can be claimed based on the user's inventory weight. if yes, then we can just simply claim everything.
        // 2. we will prioritize older crafting queues first, and then attempt to claim all assets from each queue.
        // 2a. for example, if a crafting queue has 8 of Item A and only 5 can be claimed because of weight limitations, then:
        // we will simply claim those 5, and update the crafting queue asset amount to 3 while leaving it under the `CLAIMABLE` status.
        } else {
            let finalizedTotalWeight = 0;

            // sort the claimable crafting queues by the oldest crafting start date.
            claimableCraftingQueues.sort((a, b) => a.craftingStart - b.craftingStart);

            // loop through each claimable crafting queue.
            // check if the user's inventory weight + the totalWeight of the assets to claim exceeds the limit.
            // if not, we can claim all assets from the queue.
            // if the limit is exceeded, check how many assets can be claimed based on the user's inventory weight.
            // then, we will break the loop (i.e. other crafting queues won't be handled) and claim the assets that can be claimed.
            for (const queue of claimableCraftingQueues) {
                const { asset, amount, assetType, totalWeight: queueTotalWeight } = queue.craftedAssetData;

                // check if the user's inventory weight + the totalWeight of the assets to claim exceeds the limit
                if (user.inventory.weight + finalizedTotalWeight + queueTotalWeight > user.inventory.maxWeight) {
                    // calculate how many assets can be claimed.
                    // for example, say this queue has `amount` = 10 and `queueTotalWeight` = 100. this means that 1 of this asset = 10kg.
                    // say the user's inventory weight now is 95 and the limit is 100. this means that the user CANNOT claim any asset, because claiming one will exceed the inventory weight limit (105kg > 100kg).
                    // if, however, say, the user's inventory weight is 85, then the user can claim 1 asset (85 + 10 = 95kg < 100kg).
                    const claimableAmount = Math.floor((user.inventory.maxWeight - user.inventory.weight - finalizedTotalWeight) / (queueTotalWeight / amount));

                    // if claimableAmount is 0, we can't claim any assets from this queue. break the loop.
                    if (claimableAmount === 0) {
                        break;
                    }

                    // if claimableAmount > 0, we can claim some assets from this queue.
                    // 1. add the claimable assets to the user's inventory.
                    // 2. update the crafting queue asset amount to the remaining amount.
                    // 3. increase the user's weight.
                    // 4. add the crafting queue ID to the partialClaimedCraftingQueueIDs array.
                    if (assetType === 'item') {
                        // check if the user owns this asset in their inventory
                        const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === asset);

                        // if not found, add the item to the user's inventory (along with the amount). if found, increment the amount.
                        if (itemIndex === -1) {
                            userUpdateOperations.$push['inventory.items'].$each.push({
                                type: asset,
                                amount: claimableAmount,
                                totalAmountConsumed: 0,
                                weeklyAmountConsumed: 0
                            })
                        } else {
                            userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = claimableAmount;
                        }
                    } else if (assetType === 'food') {
                        // check if the user owns the food in their inventory
                        const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === asset);

                        // if not found, add the food to the user's inventory (along with the amount). if found, increment the amount.
                        if (foodIndex === -1) {
                            userUpdateOperations.$push['inventory.foods'].$each.push({
                                type: asset,
                                amount: claimableAmount
                            })
                        } else {
                            userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = claimableAmount;
                        }
                    } else if (assetType === 'resource') {
                        // get the resource data.
                        const resourceData = resources.find(resource => resource.type === asset);

                        if (!resourceData) {
                            return {
                                status: Status.ERROR,
                                message: `(claimCraftedAssets) Resource data not found for ${asset}.`
                            }
                        }

                        // check if the user owns the resource in their inventory
                        const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === asset);

                        // if not found, add the resource to the user's inventory (along with the amount). if found, increment the amount.
                        if (resourceIndex === -1) {
                            userUpdateOperations.$push['inventory.resources'].$each.push({
                                ...resourceData,
                                amount: claimableAmount,
                                origin: ExtendedResourceOrigin.NORMAL
                            })
                        } else {
                            userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = claimableAmount;
                        }
                    }

                    // update the crafting queue asset amount to the remaining amount.
                    craftingQueueUpdateOperations.push({
                        queueId: queue._id,
                        updateOperations: {
                            $set: {
                                'craftedAssetData.amount': amount - claimableAmount
                            }
                        }
                    });

                    // update the `finalizedTotalWeight`
                    finalizedTotalWeight += queueTotalWeight / amount * claimableAmount;

                    // add the crafting queue ID to the partialClaimedCraftingQueueIDs array.
                    partialClaimedCraftingQueueIDs.push(queue._id);

                    break;
                // if the user's inventory weight + the totalWeight of the assets to claim does not exceed the limit, we can claim all assets from this queue.
                } else {
                    if (assetType === 'item') {
                        // check if the user owns this asset in their inventory
                        const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === asset);

                        // if not found, add the item to the user's inventory (along with the amount). if found, increment the amount.
                        if (itemIndex === -1) {
                            userUpdateOperations.$push['inventory.items'].$each.push({
                                type: asset,
                                amount,
                                totalAmountConsumed: 0,
                                weeklyAmountConsumed: 0
                            })
                        } else {
                            userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = amount;
                        }
                    } else if (assetType === 'food') {
                        // check if the user owns the food in their inventory
                        const foodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === asset);

                        // if not found, add the food to the user's inventory (along with the amount). if found, increment the amount.
                        if (foodIndex === -1) {
                            userUpdateOperations.$push['inventory.foods'].$each.push({
                                type: asset,
                                amount
                            })
                        } else {
                            userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = amount;
                        }
                    } else if (assetType === 'resource') {
                        // get the resource data.
                        const resourceData = resources.find(resource => resource.type === asset);

                        if (!resourceData) {
                            return {
                                status: Status.ERROR,
                                message: `(claimCraftedAssets) Resource data not found for ${asset}.`
                            }
                        }

                        // check if the user owns the resource in their inventory
                        const resourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === asset);

                        // if not found, add the resource to the user's inventory (along with the amount). if found, increment the amount.
                        if (resourceIndex === -1) {
                            userUpdateOperations.$push['inventory.resources'].$each.push({
                                ...resourceData,
                                amount,
                                origin: ExtendedResourceOrigin.NORMAL
                            })
                        } else {
                            userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = amount;
                        }
                    }

                    // add the crafting queue ID to the fullyClaimedCraftingQueueIDs array
                    fullyClaimedCraftingQueueIDs.push(queue._id);

                    // update the crafting queue status to `CLAIMED`
                    craftingQueueUpdateOperations.push({
                        queueId: queue._id,
                        updateOperations: {
                            $set: {
                                status: CraftingQueueStatus.CLAIMED
                            }
                        }
                    });

                    // update the `finalizedTotalWeight`
                    finalizedTotalWeight += queueTotalWeight;
                }
            }

            // increase the user's weight
            userUpdateOperations.$inc['inventory.weight'] = finalizedTotalWeight;
        }

        const craftingQueueUpdatePromises = craftingQueueUpdateOperations.length > 0 && craftingQueueUpdateOperations.map(async op => {
            return CraftingQueueModel.updateOne({ _id: op.queueId }, op.updateOperations);
        });

        // update the user's inventory and the crafting queues.
        // divide into $set + $inc, and then $push and $pull.
        await Promise.all([
            UserModel.updateOne({ twitterId }, {
                $set: userUpdateOperations.$set,
                $inc: userUpdateOperations.$inc
            }),
            craftingQueueUpdatePromises
        ]);

        await UserModel.updateOne({ twitterId }, {
            $push: userUpdateOperations.$push,
            $pull: userUpdateOperations.$pull
        });

        return {
            status: Status.SUCCESS,
            message: `(claimCraftedAssets) Successfully claimed crafted assets. ${partialClaimedCraftingQueueIDs.length > 0 && `Some assets from crafting queues could not be claimed fully due to inventory weight limitations.`}`,
            data: {
                fullyClaimedCraftingQueueIDs,
                partialClaimedCraftingQueueIDs
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimCraftedAssets) ${err.message}`
        }
    }
}