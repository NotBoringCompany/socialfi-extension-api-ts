import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { UserSchema } from '../schemas/User';
import { RANDOMIZE_CHEST_ITEM } from '../utils/constants/chest';
import { Food, FoodType } from '../models/food';
import { Resource, ResourceType } from '../models/resource';

/**
 * Opens a chest found across Twitter's timeline, randomizing a chest item and adding it to the user's inventory.
 */
export const openChest = async (twitterId: string, tweetId: string): Promise<ReturnValue> => {
    const User = mongoose.model('Users', UserSchema, 'Users');

    if (!tweetId) {
        return {
            status: Status.BAD_REQUEST,
            message: `(openChest) No tweet ID provided.`
        }
    }

    try {
        const user = await User.findOne({ twitterId });

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
        const isResource = Object.values(ResourceType).includes(item as ResourceType);
        const isXCookies = item === 'xCookies';
        const isBitOrb = item === 'Bit Orb';
        const isTerraCapsulator = item === 'Terra Capsulator';

        // check if the user already has the food, if yes, increment the amount, if not, add it to the user's inventory
        if (isFood) {
            const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === item);

            if (existingFoodIndex !== -1) {
                await User.updateOne({ twitterId }, {
                    $inc: {
                        [`inventory.foods.${existingFoodIndex}.amount`]: amount
                    }
                })
            } else {
                await User.updateOne({ twitterId }, {
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
                await User.updateOne({ twitterId }, {
                    $inc: {
                        [`inventory.resources.${existingResourceIndex}.amount`]: amount
                    }
                })
            } else {
                await User.updateOne({ twitterId }, {
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
            await User.updateOne({ twitterId }, {
                $inc: {
                    'inventory.xCookies': amount
                }
            
            })
        // increment the user's bit orb count
        } else if (isBitOrb) {
            await User.updateOne({ twitterId }, {
                $inc: {
                    'inventory.totalBitOrbs': amount
                }
            })
        // increment the user's terra capsulator count
        } else if (isTerraCapsulator) {
            await User.updateOne({ twitterId }, {
                $inc: {
                    'inventory.totalTerraCapsulators': amount
                }
            })
        }

        // add the tweet ID to the user's openedTweetIdsToday
        await User.updateOne({ twitterId }, {
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
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        // only find users where `openedTweetIdsToday` is not empty
        const users = await User.find({ openedTweetIdsToday: { $ne: [] } });

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
        await User.bulkWrite(bulkWriteOperations);

        console.log(`(removeOpenedTweetIdsToday) Removed all opened tweet IDs from the users' openedTweetIdsToday array.`);
    } catch (err: any) {
        console.error(`(removeOpenedTweetIdsToday) ${err.message}`);
    }
}