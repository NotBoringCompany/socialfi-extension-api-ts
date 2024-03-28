import { ReturnValue, Status } from '../utils/retVal';
import { RANDOMIZE_CHEST_ITEM } from '../utils/constants/chest';
import { Food, FoodType } from '../models/food';
import { BarrenResource, CombinedResources, Resource, ResourceType } from '../models/resource';
import { UserModel } from '../utils/constants/db';

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
        const isBitOrb = item === 'Bit Orb';
        const isTerraCapsulator = item === 'Terra Capsulator';

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
            const existingResourceIndex = (user.inventory?.resources as Resource[]).findIndex(resource => resource.type === item);

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
                            type: item,
                            amount
                        }
                    }
                })
            }
        // increment the user's xCookies
        } else if (isXCookies) {
            await UserModel.updateOne({ twitterId }, {
                $inc: {
                    'inventory.xCookies': amount
                }
            
            })
        // increment the user's bit orb count
        } else if (isBitOrb) {
            await UserModel.updateOne({ twitterId }, {
                $inc: {
                    'inventory.totalBitOrbs': amount
                }
            })
        // increment the user's terra capsulator count
        } else if (isTerraCapsulator) {
            await UserModel.updateOne({ twitterId }, {
                $inc: {
                    'inventory.totalTerraCapsulators': amount
                }
            })
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