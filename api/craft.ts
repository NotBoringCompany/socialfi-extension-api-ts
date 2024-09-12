import { AssetType } from '../models/asset';
import { CraftableAsset, CraftingRecipe } from "../models/craft";
import { CarpentingMastery, CookingMastery, SmeltingMastery, TailoringMastery } from "../models/mastery";
import { BarrenResource, ExtendedResource, ExtendedResourceOrigin, FruitResource, LiquidResource, OreResource, ResourceType, SimplifiedResource } from "../models/resource";
import { GET_CRAFT_RECIPE, getAllCraftItemRecipes, getAllCraftItems, getCraftItem, getCraftItemCriteria } from "../utils/constants/craft";
import { UserModel } from "../utils/constants/db";
import { CARPENTING_MASTERY_LEVEL, COOKING_MASTERY_LEVEL, SMELTING_MASTERY_LEVEL, TAILORING_MASTERY_LEVEL } from "../utils/constants/mastery";
import { getResource, getResourceWeight, resources } from "../utils/constants/resource";
import { ReturnValue, Status } from "../utils/retVal";

export const getCraftingRecipe = async (resultItem: ResourceType): Promise<ReturnValue> => {
    try {
        var foundRecipe = GET_CRAFT_RECIPE(resultItem);
        console.log(`Recipe Found ! : ${foundRecipe}`);
        var recipeNames = new Array();
        var recipeCounts = new Array();
        for(let i = 0 ; i < foundRecipe.length; i++)
        {
            var recipeName = foundRecipe[i].type;
            var recipeCount = foundRecipe[i].amount;
            
            recipeNames.push(recipeName);
            recipeCounts.push(recipeCount);
        }
        
        for(let i = 0 ; i < foundRecipe.length ; i++)
        {
            console.log(`${recipeNames[i]} x ${recipeCounts[i]}`);
        }
        console.log(`And will Resulting in : ${resultItem}`);

    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserData) ${err.message}`,
        };
    }
};

export const doCraft = async(twitterId: string, craftType: ResourceType, amount: number = 1) : Promise<ReturnValue> =>{
    try {
        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const user = await UserModel.findOne({ twitterId }).lean();
        const craftItem  = getCraftItem(craftType);
        var successAmount = amount;
        console.log(`You want to craft ${craftItem.type} x ${amount}`);

        //#region SuccessRate Wall
        /** I think there should be success chances, but based on current requirement all crafting will be guaranteed success */
        var baseSuccessRate = craftItem.baseSuccessChance;

        /** Success Rate Should Be Affected by your crafting level i think, it will give incentives to player to increase it's crafting level more */
        /**Comment below if you want to apply actual success chances based on the crafting item data */
        baseSuccessRate = 100;

        //baseSuccessRate = baseSuccessRate + (CraftLevel ( this should require conditional to know which crafting line are we in ) * ... * ...);
        //baseSuccessRate = (baseSuccessRate > 100 ? 100 : baseSuccessRate);

        console.log(`-----------------------====-------------------`);
        console.log(`Try to craft ${amount}pcs of ${craftItem.type} with ${baseSuccessRate}% of success rate ..`);
        
        for(let i = 0 ; i < amount ; i++)
        {
            const rollResult = Math.floor(Math.random() * (100 + 1));
            console.log(`Craft Success Rate : ${baseSuccessRate}%, current roll : ${rollResult}`);
            if(rollResult <= baseSuccessRate)
            {
                console.log(`The craft resulting in a success`);
            }
            else
            {
                successAmount--;
                console.log(`The craft resulting in a Failure`);
            }
        }

        console.log(`From ${amount} of pcs you desire to craft, you succeeded ${successAmount} times..`);

        if(successAmount <= 0)
        {
            return {
                status: Status.ERROR,
                message: `(doCraft) You failed to craft ${craftItem.type}`,
            };
        }
        console.log(`-----------------------====-------------------`);

        //#endregion

        //#region Critical Section
        //Currently ALL ITEM'S CRITICAL CHANCE IS 0
        var criticalRate = craftItem.baseCritChance;


        //criticalRate = criticalRate + (craftLevel * ... * ... *... formula here)

        var producedAmount = 0;
        producedAmount = Number(producedAmount);
        console.log(`-----------------------====-------------------`);
        console.log(`Calculating Critical Production for ${successAmount}Pcs of ${craftItem.type} with ...`);
        for(let i = 0 ; i < successAmount ; i++)
        {
            producedAmount++;
            const criticalRoll = Math.floor(Math.random() * 101);
            console.log(`Craft #${i+1} rolled in ${criticalRoll} from ${criticalRate}% Critical Rate`);
            if(criticalRoll < criticalRate)
            {
                console.log(`Craft #${i+1} resulted in critical, and yielded extra result !!`);
                producedAmount++;
            }
            else
            {
                console.log(`Craft #${i+1} does not resulted in critical, and yielded no extra result`);
            }
        }
        console.log(`After Critical Procession You will get ${producedAmount}Pcs of ${craftItem.type} in final craft production !!`);
        console.log(`-----------------------====-------------------`);

        //#endregion

        //#region LEVEL WALL
        //Level Data---
        const levelReq = craftItem.reqLevel;
        const userLevel = user.inGameData.level;
        //---Level Data

        //Check if user level is eligible to craft this item;
        console.log(`${craftItem.type} requires you to be on level ${levelReq}, now you are level ${userLevel}`);
        if(userLevel < levelReq)
        {
            console.log(`(doCraft) Your Level is Too Low to Craft ${craftType}`);
            return {
                status: Status.ERROR,
                message: `(doCraft) Your Level is Too Low to Craft ${craftType}`,
            };
        }
        const levelAbove = levelReq - userLevel;
        console.log(`You are ${levelAbove} above the requirement level, which means you're eligible !`);
        //#endregion

        //#region ENERGY WALL
        const energyReq = craftItem.baseEnergy * amount;
        const userEnergy = user.inGameData.energy.currentEnergy;
        console.log(`-----------------------====-------------------`);
        console.log(`${craftItem.type} requires ${energyReq} energy, You have ${userEnergy} energy`);
        if(userEnergy < energyReq)
        {
            console.log(`(doCraft) Your Energy is not enough to Craft ${craftType}`);
            return {
                status: Status.ERROR,
                message: `(doCraft) Your Energy is not enough to Craft ${craftType}`,
            };
        }
        else
        {
            userUpdateOperations.$inc[`inGameData.energy.currentEnergy`] = -energyReq;
        }
        const leftEnergy = userEnergy - energyReq;
        console.log(`You Have enough energy, deducting ${energyReq} now you have ${leftEnergy} left`);
        console.log(`-----------------------====-------------------`);
        //#endregion

        //#region BERRY WALL
        const berryReq = craftItem.berries * amount;
        const userBerry = user.inventory?.xCookieData.currentXCookies;

        console.log(`Crafting ${craftItem.type} requires ${berryReq} berries, You have ${userBerry} berries`);
        var berryLeft = userBerry - berryReq;
        if(berryLeft < 0)
        {
            var sortBerries = berryReq - userBerry;
            console.log(`You don't have enough berry to craft ${craftItem.type}, you have ${userBerry} in your account but you need ${berryReq}, you sort ${sortBerries}.`);
            return {
                status: Status.ERROR,
                message: `(doCraft) Your Berry is not enough to Craft ${craftType}`,
            };
        }
        else
        {
            console.log(`You have enough berry to craft ${craftItem.type} !!, deducting ${berryReq} from your ${userBerry} berries, you have ${berryLeft} berries left`);
            userUpdateOperations.$inc[`inventory.xCookieData.currentXCookies`] = -berryReq;
        }

        console.log(`Next-->`);
        //#endregion

        //#region Proficiency Wall
        const userMasteries = user.inGameData.mastery;
        const craftingLine = craftItem.line;
        const reqCraftLevel = craftItem.reqCraftLevel;
        const craftAddExp = craftItem.craftExp;
        var newTotalExp = 0;
        var newLevel = user.inGameData.mastery.tapping.level;
        
        console.log(`-----------------------====-------------------`);
        if(craftingLine === CraftItemLine.SMELTING)
        {
            const smeltingMastery = userMasteries.smelting.level;
            console.log(`${craftItem.type} requires you to be on level ${reqCraftLevel} of ${craftingLine} proficiency, your ${craftingLine} proficiency is level : ${smeltingMastery}`);
            if(smeltingMastery < reqCraftLevel)
            {
                console.log(`(doCraft) Your Smelting Mastery Not Enough to Craft ${craftType} (${smeltingMastery}, Required : ${reqCraftLevel})`);
                return {
                    status: Status.ERROR,
                    message: `(doCraft) Your Smelting Mastery Not Enough to Craft ${craftType} (${smeltingMastery}, Required : ${reqCraftLevel})`,
                };
            }
            else
            {
                newTotalExp = userMasteries.smelting.totalExp; + ( craftAddExp * producedAmount );
                const newSmeltingLevel = SMELTING_MASTERY_LEVEL(newTotalExp);
                newLevel = newSmeltingLevel;
                if(newSmeltingLevel > smeltingMastery)
                {
                    console.log(`You Leveled Up !! your Smelting level Before : ${smeltingMastery} ==> ${newSmeltingLevel}`);
                    userUpdateOperations.$set[`inGameData.mastery.smelting.level`] = newSmeltingLevel;
                }
                console.log(`You increase your Smelting Exp by ${craftAddExp * producedAmount}, which makes your exp : ${newTotalExp}`);
                userUpdateOperations.$inc[`inGameData.mastery.smelting.totalExp`] = craftAddExp * producedAmount;
            }
        }
        else if(craftingLine === CraftItemLine.COOKING)
        {
            const cookingMastery = userMasteries.cooking.level;
            console.log(`${craftItem.type} requires you to be on level ${reqCraftLevel} of ${craftingLine} proficiency, your ${craftingLine} proficiency is level : ${cookingMastery}`);
            if(cookingMastery < reqCraftLevel)
            {
                console.log(`(doCraft) Your Cooking Mastery Not Enough to Craft ${craftType} (${cookingMastery}, Required : ${reqCraftLevel})`);
                return {
                    status: Status.ERROR,
                    message: `(doCraft) Your Cooking Mastery Not Enough to Craft ${craftType} (${cookingMastery}, Required : ${reqCraftLevel})`,
                };
            }
            else
            {
                newTotalExp = userMasteries.cooking.totalExp; + ( craftAddExp * producedAmount );
                const newCookingLevel = COOKING_MASTERY_LEVEL(newTotalExp);
                newLevel = newCookingLevel;
                if(newCookingLevel > cookingMastery)
                {
                    console.log(`You Leveled Up !! your Cooking level Before : ${cookingMastery} ==> ${newCookingLevel}`);
                    userUpdateOperations.$set[`inGameData.mastery.cooking.level`] = newCookingLevel;
                }
                console.log(`You increase your Cooking Exp by ${craftAddExp * producedAmount}, which makes your exp : ${newTotalExp}`);
                userUpdateOperations.$inc[`inGameData.mastery.cooking.totalExp`] = craftAddExp * producedAmount;
            }
        }
        else if(craftingLine === CraftItemLine.CARPENTING)
        {
            const carpentingMastery = userMasteries.carpenting.level;
            console.log(`${craftItem.type} requires you to be on level ${reqCraftLevel} of ${craftingLine} proficiency, your ${craftingLine} proficiency is level : ${carpentingMastery}`);
            if(carpentingMastery < reqCraftLevel)
            {
                console.log(`(doCraft) Your Carpenting Mastery Not Enough to Craft ${craftType} (${carpentingMastery}, Required : ${reqCraftLevel})`);
                return {
                    status: Status.ERROR,
                    message: `(doCraft) Your Carpenting Mastery Not Enough to Craft ${craftType} (${carpentingMastery}, Required : ${reqCraftLevel})`,
                };
            }
            else
            {
                newTotalExp = userMasteries.carpenting.totalExp; + ( craftAddExp * producedAmount );
                const newCarpetingLevel = CARPENTING_MASTERY_LEVEL(newTotalExp);
                newLevel = newCarpetingLevel;
                if(newCarpetingLevel > carpentingMastery)
                {
                    console.log(`You Leveled Up !! your Carpenting level Before : ${carpentingMastery} ==> ${newCarpetingLevel}`);
                    userUpdateOperations.$set[`inGameData.mastery.carpenting.level`] = newCarpetingLevel;
                }
                console.log(`You increase your Carpenting Exp by ${craftAddExp * producedAmount}, which makes your exp : ${newTotalExp}`);
                userUpdateOperations.$inc[`inGameData.mastery.carpenting.totalExp`] = craftAddExp * producedAmount;
            }
        }
        else
        {
            const tailoringMastery = userMasteries.tailoring.level;
            console.log(`${craftItem.type} requires you to be on level ${reqCraftLevel} of ${craftingLine} proficiency, your ${craftingLine} proficiency is level : ${tailoringMastery}`);
            if(tailoringMastery < reqCraftLevel)
            {
                console.log(`(doCraft) Your Tailoring Mastery Not Enough to Craft ${craftType} (${tailoringMastery}, Required : ${reqCraftLevel})`);
                return {
                    status: Status.ERROR,
                    message: `(doCraft) Your Tailoring Mastery Not Enough to Craft ${craftType} (${tailoringMastery}, Required : ${reqCraftLevel})`,
                };
            }
            else
            {
                newTotalExp = userMasteries.tailoring.totalExp; + ( craftAddExp * producedAmount );
                const newTailoringLevel = TAILORING_MASTERY_LEVEL(newTotalExp);
                newLevel = newTailoringLevel;
                if(newTailoringLevel > tailoringMastery)
                {
                    console.log(`You Leveled Up !! your Tailoring level Before : ${tailoringMastery} ==> ${newTailoringLevel}`);
                    userUpdateOperations.$set[`inGameData.mastery.tailoring.level`] = newTailoringLevel;
                }
                console.log(`You increase your Tailoring Exp by ${craftAddExp * producedAmount}, which makes your exp : ${newTotalExp} from ${userMasteries.tailoring.totalExp}`);
                userUpdateOperations.$inc[`inGameData.mastery.tailoring.totalExp`] = craftAddExp * producedAmount;
            }
        }
            
        console.log(`Your are proficient enough to craft ${craftItem.type} !`);
        console.log(`-----------------------====-------------------`);
        //#endregion

        //#region Catalyst Wall
        const userResources = user.inventory.resources;
        const requiredResources = craftItem.catalyst;
        console.log(`-----------------------====-------------------`);
        console.log(`You have ${userResources.length} Resources : `);
        for(let i = 0 ; i < userResources.length ; i++)
        {
            
            console.log(`${i+1}. ${userResources[i].type} x ${userResources[i].amount}`);
        }
        console.log(`-----------------------====-------------------`);
        var updatedResourceCount = new Array();
        for(let i = 0 ; i < requiredResources.length; i++)
        {
            var res = requiredResources[i].type;
            console.log(`Searching for ${res} in your Inventory...`);
            var searchResult = userResources.find(searchItem => searchItem.type === requiredResources[i].type);
            
            if(searchResult !== undefined)
            {
                console.log(`${res} Found ! you have x${searchResult.amount}pcs of them`);
                if(searchResult.amount >= (requiredResources[i].amount * amount))
                {
                    var updatedResourceAmount = searchResult.amount - (requiredResources[i].amount * amount);
                    updatedResourceCount.push({type:searchResult.type, amount: updatedResourceAmount, before: searchResult.amount, required: requiredResources[i].amount * amount});
                }
                else
                {
                    console.log(`(doCraft) You don't have enough ${searchResult.type} to craft ${craftType}`);
                    return {
                        status: Status.ERROR,
                        message: `(doCraft) You don't have enough ${searchResult.type} to craft ${craftType}`,
                    };
                }
            }
            else
            {
                console.log(`(doCraft) Resource Required not Found ${craftType}`);
                return {
                    status: Status.ERROR,
                    message: `(doCraft) Resource Required not Found ${craftType}`,
                };
            }
        }
        console.log(`-----------------------====-------------------`);
        
        const craftResourceResult = getResource(craftItem.type);
        const craftResultWeight = craftResourceResult.weight;
        var requiredResourceTotalWeight = 0;
        const uWeight = user.inventory.weight;
        const maxWeight = user.inventory.maxWeight;

        //#endregion

        //#region Weight Wall
        for(let i = 0 ; i < updatedResourceCount.length ; i++)
        {
            var uResWeight = getResourceWeight(updatedResourceCount[i].type);
            
            //uResWeight *= updatedResourceCount[i].amount;
            requiredResourceTotalWeight += (uResWeight * updatedResourceCount[i].required);
            console.log(`UresWeight : ${uResWeight} x ${updatedResourceCount[i].required } totaling in : ${uResWeight * updatedResourceCount[i].required}`);
        }

        console.log(`Your Current Weight : ${uWeight}, Required Resource for This Craft's Weight : ${requiredResourceTotalWeight}, Crafted Item's Weight : ${(craftResultWeight * amount)}`);


        const resultWeight = uWeight - requiredResourceTotalWeight + (craftResultWeight * amount);
        if(resultWeight > maxWeight)
        {
            console.log(`(doCraft) Weight Limit Exceeded (${resultWeight})`);
            return {
                status: Status.ERROR,
                message: `(doCraft) Weight Limit Exceeded (${resultWeight})`,
            };
        }

        //#endregion

        // for(let i = 0 ; i < requiredResources.length ; i++)
        // {
        //     var resIndexes = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === requiredResources[i].type);
        //     var deductionAmount = (requiredResources[i].amount  * amount);
        //     userUpdateOperations.$inc[`inventory.resources.${resIndexes}.amount`] = -deductionAmount;
        // }


        //#region RESULT
        const iResIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === craftItem.type);
        var finalCraftResultWeight = craftResultWeight * amount;
        var finalCostWeight = - requiredResourceTotalWeight + (finalCraftResultWeight);
        
        console.log(`-----------------------====-------------------`);
        console.log(`Crafting Successful ! Resulting in : ${producedAmount} x ${craftItem.type} adding ${craftResultWeight * amount} kg of weight, Consuming : `);
        for(let i = 0 ; i < updatedResourceCount.length ; i++)
        {
            const uResIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === updatedResourceCount[i].type);
            var uResWeight = getResourceWeight(updatedResourceCount[i].type);
            userUpdateOperations.$inc[`inventory.resources.${uResIndex}.amount`] = -updatedResourceCount[i].required;
            // userUpdateOperations.$inc[`inventory.weight`] = -(uResWeight * amount);
            console.log(`${updatedResourceCount[i].type} x ${updatedResourceCount[i].required}, reducing from before : ${updatedResourceCount[i].before}, You have ${updatedResourceCount[i].amount} left`);
        }
        
        console.log(`Final Cost Weight : ${finalCostWeight}`);

        const newResourceData = resources.find(r => r.type === craftItem.type);
        userUpdateOperations.$inc[`inventory.weight`] = finalCostWeight;
        console.log(`-----------------------====-------------------`);
        if(iResIndex === -1)
        {
            console.log(`${craftItem.type} is not in your inventory, creating one right now...`);
            userUpdateOperations.$push[`inventory.resources`] = {
                ...newResourceData,
                origin: ExtendedResourceOrigin.NORMAL,
                amount: producedAmount, 
            };
            console.log(`${craftItem.type} is not in your inventory, creating one right now in the DB`);
        }
        else
        {
            console.log(`Adding ${producedAmount}Pcs of ${craftItem.type} into your inventory..`);
            userUpdateOperations.$inc[`inventory.resources.${iResIndex}.amount`] = producedAmount;
        }
        //#endregion    
        
        await UserModel.updateOne({ _id: user._id }, {
            $set: Object.keys(userUpdateOperations.$set).length > 0 ? userUpdateOperations.$set : {},
            $inc: Object.keys(userUpdateOperations.$inc).length > 0 ? userUpdateOperations.$inc : {},
        });

        await UserModel.updateOne({ _id: user._id }, {
            $pull: Object.keys(userUpdateOperations.$pull).length > 0 ? userUpdateOperations.$pull : {},
            $push: Object.keys(userUpdateOperations.$push).length > 0 ? userUpdateOperations.$push : {},
        });

        console.log(`Crafting Operation Successfully Done !`);
        return {
            status: Status.SUCCESS,
            message: `(doCraft) Craft Item Success!!`,
            data: {
                "craftItem": craftItem,
                "amount": producedAmount,
                "newLevel": newLevel,
                "newTotalExp": newTotalExp
            }
        }
    } catch (err: any) {
        console.log(`ERROR : ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(doCraft) ${err.message}`,
        };
    }
};

export const getCraftableRecipesByEnergy = async (twitterId: string): Promise<ReturnValue> => {
    try {
        // var recipes = Object.keys(CraftRecipes);
        // var noOfRecipes = recipes.length;
        // console.log(`There are : ${noOfRecipes} Recipes, which are : `);
        // for(let i = 0 ; i < noOfRecipes ; i++)
        // {
        //     console.log(recipes[i]);
        // }

        

        var allRecipes = getCraftItemCriteria(CraftItemLine.COOKING);
        console.log(`All ${CraftItemLine.COOKING} Recipes : `);
        for(let i = 0 ; i < allRecipes.length ; i++)
        {
            var recipeName = allRecipes[i].type;
            var catalyst = allRecipes[i].catalyst;
            console.log(`${recipeName}, Requires : `);
            for(let j = 0 ; j < catalyst.length; j++)
            {
                var catalystName = catalyst[j].type;
                var catalystAmount = catalyst[j].amount;
                console.log(`${catalystName} | ${catalystAmount} pcs`);
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserData) ${err.message}`,
        };
    }

};

export const getCraftableRecipesByResources = async (twitterId: string): Promise<ReturnValue> => {
    try {
        // var recipes = Object.keys(CraftRecipes);
        // var noOfRecipes = recipes.length;
        // console.log(`There are : ${noOfRecipes} Recipes, which are : `);
        // for(let i = 0 ; i < noOfRecipes ; i++)
        // {
        //     console.log(recipes[i]);
        // }

        const user = await UserModel.findOne({ twitterId }).lean();
        var inventory = user.inventory;
        var resources = inventory.resources;

        var result = new Array();
        var allCraftables = getAllCraftItems();

        for(let j = 0 ; j < allCraftables.length; j++)
        {
            var craftableCatalyst = allCraftables[j].catalyst;
            var eligbileCount = 0;
            console.log(`Recipe : ${allCraftables[j].type}`);
            for(let i = 0 ; i < resources.length ; i++)
            {
                var resName = resources[i].type;
                var resAmount = resources[i].amount;
                console.log(`Searching For : ${resName} in ${allCraftables[j].type} recipe`);
                var searchResult = craftableCatalyst.find(searchItem => searchItem.type === resName);
                
                if(searchResult !== undefined)
                {
                    if(resAmount >= searchResult.amount)
                    {
                        console.log(`Resource ${resName} is in the recipe for ${allCraftables[j].type}, requires ${searchResult.amount} and you have ${resAmount}`);
                        eligbileCount++;
                    }
                    else
                    {
                        console.log(`Resource ${resName} is in the recipe for ${allCraftables[j].type}, requires ${searchResult.amount} and you have ${resAmount}`);
                    }
                }
                else
                {
                    console.log(`Resource ${resName} is not in the recipe for ${allCraftables[j].type}`);
                }
                // for(let k = 0 ; k < craftableCatalyst.length ; k++)
                // {
                //     console.log(`Details : ${resName} | ${resAmount} | ${craftableCatalyst[k].type} | ${craftableCatalyst[k].amount}`);
                    
                    
                //     if(resName === craftableCatalyst[k].type)
                //     {
                //         if(resAmount >= craftableCatalyst[k].amount)
                //         {
                //             eligbileCount++;
                //         }
                //     }
                // }
    
                //console.log(`${resName} | ${resAmount}`);
            }

            

            console.log(`Eligible For Recipe ${allCraftables[j].type} : ${eligbileCount} || required : ${craftableCatalyst.length}`);
            console.log(`-------`);
            if(eligbileCount === craftableCatalyst.length)
            {
                result.push(allCraftables[j]);
            }
        }


        

        console.log(`There are ${result.length} Craftable Items, Which are : `);
        for(let i = 0 ; i < result.length; i++)
        {
            console.log(`${result[i].type}, which requires :`);
            for(let j = 0 ; j < result[i].catalyst.length ; j++)
            {
                var theCatalyst = result[i].catalyst[j].type;
                var theCatalystAmount = result[i].catalyst[j].amount;
                console.log(`${theCatalyst} | ${theCatalystAmount}pcs`);
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getCraftable) Craftable Sorted.`,
            data: {
                recipes: result
            },
        };

        
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserData) ${err.message}`,
        };
    }
};

export const getAllCraftingRecipes = async (): Promise<ReturnValue> => {
    try {
        // var recipes = Object.keys(CraftRecipes);
        // var noOfRecipes = recipes.length;
        // console.log(`There are : ${noOfRecipes} Recipes, which are : `);
        // for(let i = 0 ; i < noOfRecipes ; i++)
        // {
        //     console.log(recipes[i]);
        // }

        

        //var allRecipes = getCraftItemCriteria(CraftItemLine.COOKING);
        var allRecipes = getAllCraftItemRecipes();
        console.log(`All ${CraftItemLine.COOKING} Recipes : `);
        for(let i = 0 ; i < allRecipes.length ; i++)
        {
            var recipeName = allRecipes[i].type;
            var catalyst = allRecipes[i].catalyst;
            console.log(`${recipeName}, Requires : `);
            for(let j = 0 ; j < catalyst.length; j++)
            {
                var catalystName = catalyst[j].type;
                var catalystAmount = catalyst[j].amount;
                console.log(`${catalystName} | ${catalystAmount} pcs`);
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getCraftable) All Craftables Fetched.`,
            data: {
                recipes: allRecipes
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserData) ${err.message}`,
        };
    }
};

export const CheckUserMastery = async(twitterId: string): Promise<ReturnValue> =>{
    try {
        const user = await UserModel.findOne({ twitterId }).lean();
        if (!user) {
            console.error(`No user found with twitterID: ${twitterId}`);
            return;
        }

        const smeltingMastery = user.inGameData.mastery.smelting.level;

        console.log(`Your Smelting level is : ${smeltingMastery}`);
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserData) ${err.message}`,
        };
    }
};

export const UpdateUserMastery = async (twitterId: string) => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();
        if (!user) {
            console.error(`No user found with twitterID: ${twitterId}`);
            return;
        }

        const newSmeltingMastery: SmeltingMastery = {
            level: 1,
            totalExp: 0,
        };

        const newCookingMastery: CookingMastery = {
            level: 1,
            totalExp: 0,
        };

        const newCarpentingMastery: CarpentingMastery = {
            level: 1,
            totalExp: 0,
        };

        const newTailoringMastery: TailoringMastery = {
            level: 1,
            totalExp: 0,
        };

        await UserModel.updateOne(
            { _id: user._id },
            {
                $set: {
                    'inGameData.mastery.smelting': newSmeltingMastery,
                    'inGameData.mastery.cooking': newCookingMastery,
                    'inGameData.mastery.carpenting': newCarpentingMastery,
                    'inGameData.mastery.tailoring': newTailoringMastery,
                },
            }
        );
    } catch (err: any) {
        console.error(`(Update User Mastery), ${err.message}`);
    }
};
//CheckUserMastery("1929832297");
//UpdateUserMastery("1929832297");
// doCraft("1929832297", FruitResource.STAR_FRUIT, 1);
//getCraftableRecipesByResources("1929832297");
//getAllCraftingRecipes();
//getCraftingRecipe(LiquidResource.MAPLE_SYRUP);