import { AssetType } from '../models/asset';
import { CraftableAsset, CraftingRecipe } from "../models/craft";
import { LeaderboardPointsSource, LeaderboardUserData } from '../models/leaderboard';
import { BarrenResource, ExtendedResource, ExtendedResourceOrigin, FruitResource, LiquidResource, OreResource, ResourceType, SimplifiedResource } from "../models/resource";
import { CRAFT_QUEUE, CRAFTING_RECIPES, GET_CRAFTING_LEVEL } from '../utils/constants/craft';
import { LeaderboardModel, OngoingCraftModel, SquadLeaderboardModel, SquadModel, UserModel } from "../utils/constants/db";
import { CARPENTING_MASTERY_LEVEL, COOKING_MASTERY_LEVEL, SMELTING_MASTERY_LEVEL, TAILORING_MASTERY_LEVEL } from "../utils/constants/mastery";
import { getResource, getResourceWeight, resources } from "../utils/constants/resource";
import { GET_SEASON_0_PLAYER_LEVEL, GET_SEASON_0_PLAYER_LEVEL_REWARDS } from '../utils/constants/user';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from "../utils/retVal";

/**
 * Crafts a craftable asset for the user.
 * 
 * A new `OngoingCraft` instance will be created for the crafted asset, and the user's inventory will be updated accordingly once the duration expires.
 */
export const craftAsset = async (twitterId: string, assetToCraft: CraftableAsset, amount: number = 1): Promise<ReturnValue> => {
    // get the asset data from `CRAFTING_RECIPES` by querying the craftedAssetData.asset
    const craftingRecipe = CRAFTING_RECIPES.find(recipe => recipe.craftedAssetData.asset === assetToCraft);

    if (!craftingRecipe) {
        return {
            status: Status.ERROR,
            message: `(craftAsset) Crafting recipe not found.`
        }
    }

    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
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

        // check if the user has enough energy to craft the asset
        const energyRequired = craftingRecipe.baseEnergyRequired * amount;

        if (user.inGameData.energy.currentEnergy < energyRequired) {
            return {
                status: Status.ERROR,
                message: `(craftAsset) Not enough energy to craft ${amount}x ${assetToCraft}.`
            }
        }

        // if `requiredXCookies` > 0, check if the user has enough xCookies to craft the asset
        if (craftingRecipe.requiredXCookies > 0) {
            if (user.inventory?.xCookieData.currentXCookies < craftingRecipe.requiredXCookies) {
                return {
                    status: Status.ERROR,
                    message: `(craftAsset) Not enough xCookies to craft ${amount}x ${assetToCraft}.`
                }
            }
        }

        // if `requiredLevel` !== none, check if the user has the required level to craft the asset
        if (craftingRecipe.requiredLevel !== 'none') {
            if (user.inGameData.level < craftingRecipe.requiredLevel) {
                return {
                    status: Status.ERROR,
                    message: `(craftAsset) User level too low to craft ${assetToCraft}.`
                }
            }
        }

        // if `requiredCraftingLevel` !== none, check if the user has the required crafting level to craft the asset (within the line)
        if (craftingRecipe.requiredCraftingLevel !== 'none') {
            if (user.inGameData.mastery.crafting[craftingRecipe.craftingRecipeLine.toLowerCase()].level < craftingRecipe.requiredCraftingLevel){
                return {
                    status: Status.ERROR,
                    message: `(craftAsset) User crafting level too low to craft ${assetToCraft}.`
                }
            }
        }

        // if weight > 0, check if the user's inventory can still hold the crafted asset (x the amount).
        if (craftingRecipe.weight > 0) {
            const userWeight = user.inventory.weight;
            const maxWeight = user.inventory.maxWeight;
            const totalWeight = craftingRecipe.weight * amount;

            if (userWeight + totalWeight > maxWeight) {
                return {
                    status: Status.ERROR,
                    message: `(craftAsset) User inventory weight limit exceeded. Cannot craft ${amount}x ${assetToCraft}`
                }
            }
        }

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
        const currentCraftingLineData = user.inGameData.mastery.crafting[craftingRecipe.craftingRecipeLine.toLowerCase()];
        // check, with the obtainedXP, if the user will level up in the crafting line
        const newCraftingLevel = GET_CRAFTING_LEVEL(craftingRecipe.craftingRecipeLine, currentCraftingLineData.xp + (craftingRecipe.earnedXP * amount));

        // set the new XP for the crafting line
        userUpdateOperations.$inc[`inGameData.mastery.crafting.${craftingRecipe.craftingRecipeLine.toLowerCase()}.xp`] = craftingRecipe.earnedXP * amount;

        // if the user will level up, set the new level
        if (newCraftingLevel > currentCraftingLineData.level) {
            userUpdateOperations.$set[`inGameData.mastery.crafting.${craftingRecipe.craftingRecipeLine.toLowerCase()}.level`] = newCraftingLevel;
        }

        // do task 4.
        // reduce the user's energy
        userUpdateOperations.$inc[`inGameData.energy.currentEnergy`] = -energyRequired;

        // create a new ongoing craft instance in the database.
        const newOngoingCraft = new OngoingCraftModel({
            _id: generateObjectId(),
            userId: user._id,
            craftedAsset: assetToCraft,
            amount: obtainedAssetCount,
            craftingStart: Math.floor(Date.now() / 1000),
            craftingEnd: Math.floor(Date.now() / 1000) + craftingRecipe.craftingDuration
        });

        await newOngoingCraft.save();

        // add the ongoing craft to the queue to be completed once the duration expires.
        CRAFT_QUEUE.add(
            'completeCraft', 
            {
                userId: user._id,
                craftedAssetData: craftingRecipe.craftedAssetData,
                amount: obtainedAssetCount,
                craftingDuration: craftingRecipe.craftingDuration,
                weight: craftingRecipe.weight * obtainedAssetCount
            }, 
            { delay: craftingRecipe.craftingDuration * 1000 }
        );

        return {
            status: Status.SUCCESS,
            message: `(craftAsset) Added ${obtainedAssetCount}x ${assetToCraft} to the crafting queue.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(craftAsset) ${err.message}`,
        }
    }
}

// export const getCraftableRecipesByResources = async (twitterId: string): Promise<ReturnValue> => {
//     try {
//         // var recipes = Object.keys(CraftRecipes);
//         // var noOfRecipes = recipes.length;
//         // console.log(`There are : ${noOfRecipes} Recipes, which are : `);
//         // for(let i = 0 ; i < noOfRecipes ; i++)
//         // {
//         //     console.log(recipes[i]);
//         // }

//         const user = await UserModel.findOne({ twitterId }).lean();
//         var inventory = user.inventory;
//         var resources = inventory.resources;

//         var result = new Array();
//         var allCraftables = getAllCraftItems();

//         for(let j = 0 ; j < allCraftables.length; j++)
//         {
//             var craftableCatalyst = allCraftables[j].catalyst;
//             var eligbileCount = 0;
//             console.log(`Recipe : ${allCraftables[j].type}`);
//             for(let i = 0 ; i < resources.length ; i++)
//             {
//                 var resName = resources[i].type;
//                 var resAmount = resources[i].amount;
//                 console.log(`Searching For : ${resName} in ${allCraftables[j].type} recipe`);
//                 var searchResult = craftableCatalyst.find(searchItem => searchItem.type === resName);
                
//                 if(searchResult !== undefined)
//                 {
//                     if(resAmount >= searchResult.amount)
//                     {
//                         console.log(`Resource ${resName} is in the recipe for ${allCraftables[j].type}, requires ${searchResult.amount} and you have ${resAmount}`);
//                         eligbileCount++;
//                     }
//                     else
//                     {
//                         console.log(`Resource ${resName} is in the recipe for ${allCraftables[j].type}, requires ${searchResult.amount} and you have ${resAmount}`);
//                     }
//                 }
//                 else
//                 {
//                     console.log(`Resource ${resName} is not in the recipe for ${allCraftables[j].type}`);
//                 }
//                 // for(let k = 0 ; k < craftableCatalyst.length ; k++)
//                 // {
//                 //     console.log(`Details : ${resName} | ${resAmount} | ${craftableCatalyst[k].type} | ${craftableCatalyst[k].amount}`);
                    
                    
//                 //     if(resName === craftableCatalyst[k].type)
//                 //     {
//                 //         if(resAmount >= craftableCatalyst[k].amount)
//                 //         {
//                 //             eligbileCount++;
//                 //         }
//                 //     }
//                 // }
    
//                 //console.log(`${resName} | ${resAmount}`);
//             }

            

//             console.log(`Eligible For Recipe ${allCraftables[j].type} : ${eligbileCount} || required : ${craftableCatalyst.length}`);
//             console.log(`-------`);
//             if(eligbileCount === craftableCatalyst.length)
//             {
//                 result.push(allCraftables[j]);
//             }
//         }


        

//         console.log(`There are ${result.length} Craftable Items, Which are : `);
//         for(let i = 0 ; i < result.length; i++)
//         {
//             console.log(`${result[i].type}, which requires :`);
//             for(let j = 0 ; j < result[i].catalyst.length ; j++)
//             {
//                 var theCatalyst = result[i].catalyst[j].type;
//                 var theCatalystAmount = result[i].catalyst[j].amount;
//                 console.log(`${theCatalyst} | ${theCatalystAmount}pcs`);
//             }
//         }

//         return {
//             status: Status.SUCCESS,
//             message: `(getCraftable) Craftable Sorted.`,
//             data: {
//                 recipes: result
//             },
//         };

        
//     } catch (err: any) {
//         return {
//             status: Status.ERROR,
//             message: `(getUserData) ${err.message}`,
//         };
//     }
// };

// export const getAllCraftingRecipes = async (): Promise<ReturnValue> => {
//     try {
//         // var recipes = Object.keys(CraftRecipes);
//         // var noOfRecipes = recipes.length;
//         // console.log(`There are : ${noOfRecipes} Recipes, which are : `);
//         // for(let i = 0 ; i < noOfRecipes ; i++)
//         // {
//         //     console.log(recipes[i]);
//         // }

        

//         //var allRecipes = getCraftItemCriteria(CraftItemLine.COOKING);
//         var allRecipes = getAllCraftItemRecipes();
//         console.log(`All ${CraftItemLine.COOKING} Recipes : `);
//         for(let i = 0 ; i < allRecipes.length ; i++)
//         {
//             var recipeName = allRecipes[i].type;
//             var catalyst = allRecipes[i].catalyst;
//             console.log(`${recipeName}, Requires : `);
//             for(let j = 0 ; j < catalyst.length; j++)
//             {
//                 var catalystName = catalyst[j].type;
//                 var catalystAmount = catalyst[j].amount;
//                 console.log(`${catalystName} | ${catalystAmount} pcs`);
//             }
//         }

//         return {
//             status: Status.SUCCESS,
//             message: `(getCraftable) All Craftables Fetched.`,
//             data: {
//                 recipes: allRecipes
//             },
//         };
//     } catch (err: any) {
//         return {
//             status: Status.ERROR,
//             message: `(getUserData) ${err.message}`,
//         };
//     }
// };

// export const CheckUserMastery = async(twitterId: string): Promise<ReturnValue> =>{
//     try {
//         const user = await UserModel.findOne({ twitterId }).lean();
//         if (!user) {
//             console.error(`No user found with twitterID: ${twitterId}`);
//             return;
//         }

//         const smeltingMastery = user.inGameData.mastery.smelting.level;

//         console.log(`Your Smelting level is : ${smeltingMastery}`);
//     } catch (err: any) {
//         return {
//             status: Status.ERROR,
//             message: `(getUserData) ${err.message}`,
//         };
//     }
// };

// export const UpdateUserMastery = async (twitterId: string) => {
//     try {
//         const user = await UserModel.findOne({ twitterId }).lean();
//         if (!user) {
//             console.error(`No user found with twitterID: ${twitterId}`);
//             return;
//         }

//         const newSmeltingMastery: SmeltingMastery = {
//             level: 1,
//             totalExp: 0,
//         };

//         const newCookingMastery: CookingMastery = {
//             level: 1,
//             totalExp: 0,
//         };

//         const newCarpentingMastery: CarpentingMastery = {
//             level: 1,
//             totalExp: 0,
//         };

//         const newTailoringMastery: TailoringMastery = {
//             level: 1,
//             totalExp: 0,
//         };

//         await UserModel.updateOne(
//             { _id: user._id },
//             {
//                 $set: {
//                     'inGameData.mastery.smelting': newSmeltingMastery,
//                     'inGameData.mastery.cooking': newCookingMastery,
//                     'inGameData.mastery.carpenting': newCarpentingMastery,
//                     'inGameData.mastery.tailoring': newTailoringMastery,
//                 },
//             }
//         );
//     } catch (err: any) {
//         console.error(`(Update User Mastery), ${err.message}`);
//     }
// };
// //CheckUserMastery("1929832297");
// //UpdateUserMastery("1929832297");
// // doCraft("1929832297", FruitResource.STAR_FRUIT, 1);
// //getCraftableRecipesByResources("1929832297");
// //getAllCraftingRecipes();
// //getCraftingRecipe(LiquidResource.MAPLE_SYRUP);