import { ReturnValue, Status } from '../utils/retVal';
import { RANDOMIZE_CHEST_ITEM } from '../utils/constants/chest';
import { Food, FoodType } from '../models/food';
import { BarrenResource, CombinedResources, ExtendedResource, Resource, ResourceType } from '../models/resource';
import { UserModel } from '../utils/constants/db';
import { resources } from '../utils/constants/resource';
import { BitOrbType } from '../models/bitOrb';
import { TerraCapsulatorType } from '../models/terraCapsulator';
import { Item } from '../models/item';
import { ExtendedXCookieData, XCookieSource } from '../models/user';

/**
 * Opens a chest found across Twitter's timeline, randomizing a chest item and adding it to the user's inventory.
 */
export const openChest = async (twitterId: string, tweetId: string): Promise<ReturnValue> => {
    if (!tweetId) {
        return {
            status: Status.BAD_REQUEST,
            message: `(openChest) No tweet ID provided.`
        }
    }

    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(openChest) User not found.`
            }
        }

        // check if the user has already opened this tweet today
        const hasOpenedTweetToday = user.openedTweetIdsToday.includes(tweetId);

        if (hasOpenedTweetToday) {
            return {
                status: Status.BAD_REQUEST,
                message: `(openChest) User has already opened this tweet today.`
            }
        }

        // randomize a chest item
        const { item, amount } = RANDOMIZE_CHEST_ITEM();

        // check which category the `item` falls under
        const isFood = Object.values(FoodType).includes(item as FoodType);
        const isResource = Object.values(CombinedResources).includes(item as ResourceType);
        const isXCookies = item === 'xCookies';
        const isBitOrbI = item === BitOrbType.BIT_ORB_I;
        const isTerraCapsulatorI = item === TerraCapsulatorType.TERRA_CAPSULATOR_I;

        // check if the user already has the food, if yes, increment the amount, if not, add it to the user's inventory
        if (isFood) {
            const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === item);

            if (existingFoodIndex !== -1) {
                await UserModel.updateOne({ twitterId }, {
                    $inc: {
                        [`inventory.foods.${existingFoodIndex}.amount`]: amount
                    }
                })
            } else {
                await UserModel.updateOne({ twitterId }, {
                    $push: {
                        'inventory.foods': {
                            type: item,
                            amount
                        }
                    }
                })
            }
        // check if the user already has the resource, if yes, increment the amount, if not, add it to the user's inventory
        } else if (isResource) {
            const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === item);

            // get the full resource based on the 'item' (at this point, the item is a ResourceType)
            const resource: Resource = resources.find(resource => resource.type === item as ResourceType);

            if (existingResourceIndex !== -1) {
                await UserModel.updateOne({ twitterId }, {
                    $inc: {
                        [`inventory.resources.${existingResourceIndex}.amount`]: amount
                    }
                })
            } else {
                await UserModel.updateOne({ twitterId }, {
                    $push: {
                        'inventory.resources': {
                            ...resource,
                            amount
                        }
                    }
                })
            }
        // increment the user's xCookies
        } else if (isXCookies) {
            // do 2 things:
            // 1. increment the user's xCookies
            // 2. check if the user's `xCookieData.extendedXCookieData` contains the source CHEST_REWARDS.
            // if it does, increment the amount, if not, add it to the user's `xCookieData.extendedXCookieData`
            // check if the user has `CHEST_REWARDS` in their `extendedXCookieData`
            const chestRewardsIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(data => data.source === XCookieSource.CHEST_REWARDS);

            if (chestRewardsIndex !== -1) {
                await UserModel.updateOne({ twitterId }, {
                    $inc: {
                        'inventory.xCookieData.currentXCookies': amount,
                        [`inventory.xCookieData.extendedXCookieData.${chestRewardsIndex}.xCookies`]: amount
                    }
                })
            } else {
                await UserModel.updateOne({ twitterId }, {
                    $inc: {
                        'inventory.xCookieData.currentXCookies': amount
                    },
                    $push: {
                        'inventory.xCookieData.extendedXCookieData': {
                            xCookies: amount,
                            source: XCookieSource.CHEST_REWARDS
                        }
                    }
                })
            }
        // increment the user's bit orb count
        } else if (isBitOrbI) {
            // check if the user already has the bit orb, if yes, increment the amount, if not, add it to the user's inventory
            const existingBitOrbIndex = (user.inventory?.items as Item[]).findIndex(i => i.type === item);

            if (existingBitOrbIndex !== -1) {
                await UserModel.updateOne({ twitterId }, {
                    $inc: {
                        [`inventory.items.${existingBitOrbIndex}.amount`]: amount
                    }
                })
            } else {
                await UserModel.updateOne({ twitterId }, {
                    $push: {
                        'inventory.items': {
                            type: item,
                            amount
                        }
                    }
                })
            }
        // increment the user's terra capsulator count
        } else if (isTerraCapsulatorI) {
            // check if the user already has the terra capsulator, if yes, increment the amount, if not, add it to the user's inventory
            const existingTerraCapsulatorIndex = (user.inventory?.items as Item[]).findIndex(i => i.type === item);

            if (existingTerraCapsulatorIndex !== -1) {
                await UserModel.updateOne({ twitterId }, {
                    $inc: {
                        [`inventory.items.${existingTerraCapsulatorIndex}.amount`]: amount
                    }
                })
            } else {
                await UserModel.updateOne({ twitterId }, {
                    $push: {
                        'inventory.items': {
                            type: item,
                            amount
                        }
                    }
                })
            }
        }

        // add the tweet ID to the user's openedTweetIdsToday
        await UserModel.updateOne({ twitterId }, {
            $push: {
                openedTweetIdsToday: tweetId
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(openChest) Successfully opened the chest and added the item to the user's inventory.`,
            data: {
                item,
                amount
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(openChest) ${err.message}`
        }
    }
}

/**
 * Removes all opened tweet IDs from the user's `openedTweetIdsToday` array.
 * 
 * Should be called by a scheduler every 23:59 UTC.
 */
export const removeOpenedTweetIdsToday = async (): Promise<void> => {
    try {
        // only find users where `openedTweetIdsToday` is not empty
        const users = await UserModel.find({ openedTweetIdsToday: { $ne: [] } }).lean();

        if (users.length === 0 || !users) {
            console.log(`(removeOpenedTweetIdsToday) No users found with opened tweet IDs today.`);
            return;
        }

        // prepare bulk write operations to remove all opened tweet IDs from the `openedTweetIdsToday` array
        const bulkWriteOperations = users.map(user => {
            let updateOperations = [];

            // remove all opened tweet IDs from the user's `openedTweetIdsToday` array
            updateOperations.push({
                updateOne: {
                    filter: { twitterId: user.twitterId },
                    update: {
                        $set: {
                            openedTweetIdsToday: []
                        }
                    }
                }
            });

            return updateOperations;
        }).flat();

        // execute the bulk write operations
        await UserModel.bulkWrite(bulkWriteOperations);

        console.log(`(removeOpenedTweetIdsToday) Removed all opened tweet IDs from the users' openedTweetIdsToday array.`);
    } catch (err: any) {
        console.error(`(removeOpenedTweetIdsToday) ${err.message}`);
    }
}