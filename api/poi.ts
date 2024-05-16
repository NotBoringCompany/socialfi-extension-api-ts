import { BoosterItem } from '../models/booster';
import { Food } from '../models/food';
import { Item } from '../models/item';
import { LeaderboardPointsSource } from '../models/leaderboard';
import { POIName, POIShop, POIShopActionItemData, POIShopItemName } from '../models/poi';
import { ExtendedResource } from '../models/resource';
import { LeaderboardModel, POIModel, RaftModel, SquadLeaderboardModel, SquadModel, UserModel } from '../utils/constants/db';
import { POI_TRAVEL_LEVEL_REQUIREMENT } from '../utils/constants/poi';
import { ACTUAL_RAFT_SPEED } from '../utils/constants/raft';
import { GET_SEASON_0_PLAYER_LEVEL, GET_SEASON_0_PLAYER_LEVEL_REWARDS } from '../utils/constants/user';
import { ReturnValue, Status } from '../utils/retVal';
import { updateReferredUsersData } from './user';

/**
 * Adds a new POI to the database. Only callable by admin.
 */
export const addPOI = async (
    name: POIName,
    distanceTo: { [destination in POIName]?: number },
    shop: POIShop,
    adminKey: string
): Promise<ReturnValue> => {
    if (adminKey !== process.env.ADMIN_KEY) {
        throw new Error(`Invalid admin key.`);
    }

    try {
        // check if a POI with the existing POI name already exists
        const existingPOI = await POIModel.findOne({ name });

        if (existingPOI) {
            return {
                status: Status.BAD_REQUEST,
                message: `(addPOI) POI already exists.`
            }
        }

        // create a new POI
        const newPOI = new POIModel({
            name,
            distanceTo,
            shop
        });

        await newPOI.save();

        return {
            status: Status.SUCCESS,
            message: `(addPOI) POI added. Name: ${name}`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addPOI) ${err.message}`
        }
    }
}

/**
 * (User) Travels to a different POI. Requires time.
 */
export const travelToPOI = async (
    twitterId: string,
    destination: POIName
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(travelToPOI) User not found.`
            }
        }

        // get the current POI the user is in
        const currentPOI: POIName = user.inGameData.location;

        if (currentPOI === destination) {
            return {
                status: Status.BAD_REQUEST,
                message: `(travelToPOI) User is already in ${destination}.`
            }
        }

        // if the user is already travelling to a different POI, return an error
        if (user.inGameData.travellingTo) {
            return {
                status: Status.BAD_REQUEST,
                message: `(travelToPOI) User is already travelling to ${user.inGameData.travellingTo}.`
            }
        }

        // check if the user's level is high enough to travel to the destination
        const requiredLevel = POI_TRAVEL_LEVEL_REQUIREMENT(destination);

        if (user.inGameData.level < requiredLevel) {
            return {
                status: Status.BAD_REQUEST,
                message: `(travelToPOI) User must be at least level ${requiredLevel} to travel to ${destination}.`
            }
        }

        // get the user's raft and current POI data
        const [raft, currentPOIData] = await Promise.all([
            RaftModel.findOne({ raftId: user.inventory.raftId }).lean(),
            POIModel.findOne({ name: currentPOI }).lean()
        ]);

        const distanceToDestination = currentPOIData.distanceTo[destination];

        // get the raft speed
        const raftSpeed = ACTUAL_RAFT_SPEED(raft.stats.baseSpeed, raft.currentLevel);

        // calculate the time it takes to travel to the destination
        const timeToTravel = distanceToDestination / raftSpeed;

        // get the current timestamp
        const currentTime = Math.floor(Date.now() / 1000);

        console.log('currentTime:', currentTime);
        console.log('timeToTravel:', timeToTravel);
        console.log('destinationArrival:', Math.ceil(currentTime + timeToTravel));

        // update the user's data
        // 1. set `travellingTo` in the user's inGameData to the destination
        // 2. set `destinationArrival` in the user's inGameData to the current time + timeToTravel
        await UserModel.updateOne({ twitterId }, {
            $set: {
                'inGameData.travellingTo': destination,
                'inGameData.destinationArrival': Math.ceil(currentTime + timeToTravel)
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(travelToPOI) Travelling to ${destination}. Arrival in ${timeToTravel} seconds.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(travelToPOI) ${err.message}`
        }
    }
}

/**
 * (User) Applies a booster to the user's raft when they're travelling.
 */
export const applyTravelBooster = async (
    twitterId: string,
    booster: BoosterItem
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(applyTravelBooster) User not found.`
            }
        }

        // check if the user is currently travelling
        if (!user.inGameData.travellingTo) {
            return {
                status: Status.BAD_REQUEST,
                message: `(applyTravelBooster) User is not travelling.`
            }
        }

        // check if the user has at least 1 of the booster item
        const boosterIndex = (user.inventory.items as Item[]).findIndex(item => item.type === booster);

        if (boosterIndex === -1) {
            return {
                status: Status.BAD_REQUEST,
                message: `(applyTravelBooster) Booster item not found in user's inventory.`
            }
        }

        // if booster specified doesn't contain "Raft Speed Booster", return an error
        if (!booster.includes('Raft Speed Booster')) {
            return {
                status: Status.BAD_REQUEST,
                message: `(applyTravelBooster) Invalid booster item.`
            }
        }

        // get the remaining time to travel
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const destinationArrival = user.inGameData.destinationArrival;

        // this shouldn't happen, but just in case
        if (destinationArrival < currentTimestamp) {
            return {
                status: Status.BAD_REQUEST,
                message: `(applyTravelBooster) User has already arrived.`
            }
        }

        const remainingTime = destinationArrival - currentTimestamp;

        // the booster will be called something like 'Raft Speed Booster 10 Min'
        // we extract the number of minutes from the booster item
        const boosterMinutes = parseInt(booster.split(' ')[3]);
        const boosterSeconds = boosterMinutes * 60;

        // check if the remaining time is less than the booster's effect
        // if it is, then the user will instantly arrive at their destination.
        if (remainingTime < boosterSeconds) {
            // // set the user's in game location to the destination and reduce the booster item by 1.
            // userUpdateOperations.$pull[`inventory.items`] = { type: booster };

            // // update the user's location to the destination
            // userUpdateOperations.$set = {
            //     'inGameData.location': user.inGameData.travellingTo,
            //     'inGameData.travellingTo': null,
            //     'inGameData.destinationArrival': 0
            // }

            // update the user's location to the destination
            userUpdateOperations.$set = {
                'inGameData.location': user.inGameData.travellingTo,
                'inGameData.travellingTo': null,
                'inGameData.destinationArrival': 0
            }

            // check if the user has 1 of this booster left. if yes, we remove the booster from the user's inventory.
            // if not, we decrement the booster by 1.
            if ((user.inventory.items as Item[])[boosterIndex].amount === 1) {
                userUpdateOperations.$pull[`inventory.items`] = { type: booster };
            } else {
                userUpdateOperations.$inc[`inventory.items.${boosterIndex}.amount`] = -1;
            }

            // update the user's data
            await UserModel.updateOne({ twitterId }, userUpdateOperations);

            return {
                status: Status.SUCCESS,
                message: `(applyTravelBooster) User arrived at ${user.inGameData.travellingTo} instantly due to booster effect.`,
                data: {
                    newDestinationArrival: 0,
                    booster
                }
            }
            // otherwise
        } else {
            // we will reduce `destinationArrival` by the booster's effect
            userUpdateOperations.$set = {
                'inGameData.destinationArrival': destinationArrival - boosterSeconds
            }

            // check if the user has 1 of this booster left. if yes, we remove the booster from the user's inventory.
            // if not, we decrement the booster by 1.
            if ((user.inventory.items as Item[])[boosterIndex].amount === 1) {
                userUpdateOperations.$pull[`inventory.items`] = { type: booster };
            } else {
                userUpdateOperations.$inc[`inventory.items.${boosterIndex}.amount`] = -1;
            }

            // update the user's data
            await UserModel.updateOne({ twitterId }, userUpdateOperations);

            return {
                status: Status.SUCCESS,
                message: `(applyTravelBooster) Booster ${booster} applied.`,
                data: {
                    newDestinationArrival: destinationArrival - boosterSeconds,
                    booster
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(applyTravelBooster) ${err.message}`
        }
    }
}

/**
 * Called when the user has arrived at their destination (from the frontend).
 */
export const updateArrival = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(updateArrival) User not found.`
            }
        }

        // ensure that the user is currently travelling (i.e. `travellingTo` is not null)
        if (!user.inGameData.travellingTo) {
            return {
                status: Status.BAD_REQUEST,
                message: `(updateArrival) User is not travelling.`
            }
        }

        // get the current time
        const currentTime = Math.floor(Date.now() / 1000);

        // get the user's destination arrival time
        const destinationArrival = user.inGameData.destinationArrival;

        // check if the user has arrived at their destination
        if (currentTime < destinationArrival) {
            return {
                status: Status.BAD_REQUEST,
                message: `(updateArrival) User has not arrived yet.`
            }
        }

        // user has arrived.
        // 1. update travellingTo to null
        // 2. update destinationArrival to 0
        // 3. update location to the destination
        const travellingTo = user.inGameData.travellingTo;

        await UserModel.updateOne({ twitterId }, {
            $set: {
                'inGameData.travellingTo': null,
                'inGameData.destinationArrival': 0,
                'inGameData.location': travellingTo
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(updateArrival) User has arrived at ${travellingTo}.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateArrival) ${err.message}`
        }
    }
}

/**
 * Gets the user's current location.
 */
export const getCurrentLocation = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getCurrentLocation) User not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getCurrentLocation) Current location fetched.`,
            data: {
                location: user.inGameData.location
            }

        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getCurrentLocation) ${err.message}`
        }
    }
}

/**
 * Gets all available POI destinations the user can travel to (which excludes their current location).
 */
export const getAvailablePOIDestinations = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getAvailablePOIDestinations) User not found.`
            }
        }

        // get the user's current location
        const currentLocation = user.inGameData.location;

        // get all POIs (available from the POIName enum)
        const allPOIs = Object.values(POIName);

        // remove the user's current location from the list of all POIs
        const availableDestinationNames = allPOIs.filter(poi => poi !== currentLocation);

        // return the full data of all available destinations
        const availableDestinations = await POIModel.find({ name: { $in: availableDestinationNames } }).lean();

        return {
            status: Status.SUCCESS,
            message: `(getAvailablePOIDestinations) Available POI destinations fetched.`,
            data: {
                availableDestinations
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getAvailablePOIDestinations) ${err.message}`
        }
    }
}

/**
 * Adds or replaces a POI's shop. 
 */
export const addOrReplacePOIShop = async (
    poiName: POIName,
    shop: POIShop,
    adminKey: string
): Promise<ReturnValue> => {
    if (adminKey !== process.env.ADMIN_KEY) {
        return {
            status: Status.UNAUTHORIZED,
            message: `(addOrReplacePOIShop) Invalid admin key.`
        }
    }

    try {
        const poi = await POIModel.findOne({ name: poiName });

        if (!poi) {
            return {
                status: Status.BAD_REQUEST,
                message: `(addOrUpdatePOIShop) POI not found.`
            }
        }

        // add or replace/update an existing shop for the POI
        await POIModel.updateOne({ name: poiName }, {
            $set: {
                shop: shop
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(addOrUpdatePOIShop) POI shop added/updated.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addOrUpdatePOIShop) ${err.message}`
        }
    }
}

/**
 * Gets the current POI of the user (i.e. where the user is located)
 */
export const getCurrentPOI = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getCurrentPOI) User not found.`
            }
        }

        const poiName = user.inGameData.location;

        const poi = await POIModel.findOne({ name: poiName }).lean();

        if (!poi) {
            return {
                status: Status.ERROR,
                message: `(getCurrentPOI) POI not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getCurrentPOI) Current POI fetched.`,
            data: {
                currentPOI: poi
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getCurrentPOI) ${err.message}`
        }
    }
}

/**
 * (User) Sells 1 or more items in the POI shop in exchage for leaderboard points.
 * 
 * If a leaderboard is not selected, the code automatically searches for the most recent leaderboard to add the points to.
 * 
 * Must be a minimum of 1 of each item to sell.
 */
export const sellItemsInPOIShop = async (
    twitterId: string,
    items: POIShopActionItemData[],
    leaderboardName: string | null,
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

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

        const poiUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const squadUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const squadLeaderboardUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(sellItemsInPOIShop) User not found.`
            }
        }

        // check if the user is in a squad.
        const squadId: string | null = user.inGameData.squadId;

        // check if at least 1 item is present and that the amount of that item is at least 1.
        if (items.length === 0 || items.some(item => item.amount < 1)) {
            return {
                status: Status.BAD_REQUEST,
                message: `(sellItemsInPOIShop) At least 1 item must be sold.`
            }
        }

        // get the user's current location to get the POI shop.
        const { status, message, data } = await getCurrentPOI(twitterId);

        if (status !== Status.SUCCESS) {
            return {
                status,
                message
            }
        }

        const poiShop = data.currentPOI.shop as POIShop;

        // check if:
        // 1. 1 or more items are not available in the POI shop (cannot be found)
        // 2. 1 or more items have a sellableAmount of 0
        // 3. 1 or more items have a sellableAmount less than the amount the user wants to sell
        // 4. check if despite having a sellableAmount > 0 if the `leaderboardPoints` is unavailable.
        // 5. the user doesn't have the amount of items they want to sell (for any of the specified items)
        // if one of these conditions are met, return an error.

        // we do this by returning true for any invalidity from this function.
        const invalidItems = items.filter(item => {
            const globalItems = poiShop.globalItems;
            const playerItems = poiShop.playerItems;

            const globalItem = globalItems.find(globalItem => globalItem.name === item.item);
            const playerItem = playerItems.find(playerItem => playerItem.name === item.item);

            // if not available as a global item or player item, return true
            if (!globalItem && !playerItem) {
                return true;
            }

            const itemData = globalItem ? globalItem : playerItem;

            // if the item is a global item, check if `sellableAmount` is 0.
            // if it is, return true.
            if (globalItem && globalItem.sellableAmount === 0) {
                return true;
            }

            // if the item is a player item, check if:
            // 1. the sellableAmount is 0.
            // 2. if not, check if the user exists in `userTransactionData`.
            // 3. if the user exists, check how many of this item the user has sold so far via `soldAmount`.
            // 4. if `sellableAmount` - `soldAmount` is less than the amount the user wants to sell, return true.
            if (playerItem) {
                if (playerItem.sellableAmount === 0) {
                    return true;
                }

                const userTransactionData = playerItem.userTransactionData.find(transactionData => transactionData.userId === user._id);

                if (userTransactionData) {
                    const soldAmount = userTransactionData.soldAmount;

                    if (playerItem.sellableAmount !== 'infinite' && playerItem.sellableAmount as number - soldAmount < item.amount) {
                        return true;
                    }
                }
            }

            // check if despite having a sellableAmount > 0 if the `leaderboardPoints` is unavailable.
            if (itemData.sellingPrice.leaderboardPoints === 'unavailable') {
                return true;
            }

            // search for this item in the user's inventory (which includes resources, items, foods)
            // if the item specified is `Bit Orb (I)` or `Terra Capsulator (I)`, check the count for these types respectively.
            // otherwise, check the items array.
            if (
                item.item === POIShopItemName.SEAWEED ||
                item.item === POIShopItemName.STONE ||
                item.item === POIShopItemName.COPPER ||
                item.item === POIShopItemName.IRON ||
                item.item === POIShopItemName.SILVER ||
                item.item === POIShopItemName.GOLD ||
                item.item === POIShopItemName.BLUEBERRY ||
                item.item === POIShopItemName.APPLE ||
                item.item === POIShopItemName.STAR_FRUIT ||
                item.item === POIShopItemName.MELON ||
                item.item === POIShopItemName.DRAGON_FRUIT ||
                item.item === POIShopItemName.WATER ||
                item.item === POIShopItemName.MAPLE_SYRUP ||
                item.item === POIShopItemName.HONEY ||
                item.item === POIShopItemName.MOONLIGHT_DEW ||
                item.item === POIShopItemName.PHOENIX_TEAR
            ) {
                // check the resources array
                const resource = (user.inventory.resources as ExtendedResource[]).find(resource => resource.type === item.item as string);

                return !resource || resource.amount < item.amount;
            } else if (
                item.item === POIShopItemName.CANDY ||
                item.item === POIShopItemName.CHOCOLATE ||
                item.item === POIShopItemName.JUICE ||
                item.item === POIShopItemName.BURGER
            ) {
                // check the foods array
                const food = (user.inventory.foods as Food[]).find(food => food.type === item.item as string);

                return !food || food.amount < item.amount;
                // if terra cap or bit orb (which at this point is 'else')
            } else if (item.item === POIShopItemName.TERRA_CAPSULATOR_I) {
                // check if the user owns this terra capsulator type. if they do, check if the amount they want to sell is less than the amount they own.
                const terraCapsulator = (user.inventory.items as Item[]).find(i => i.type === item.item as string);

                return !terraCapsulator || terraCapsulator.amount < item.amount;
            } else if (item.item === POIShopItemName.BIT_ORB_I) {
                // check if the user owns this bit orb type. if they do, check if the amount they want to sell is less than the amount they own.
                const bitOrb = (user.inventory.items as Item[]).find(i => i.type === item.item as string);

                return !bitOrb || bitOrb.amount < item.amount;
                // right now, we don't have any other items in the POI shop, so we just return true since it's invalid.
            } else {
                return true;
            }
        });

        if (invalidItems.length > 0) {
            return {
                status: Status.BAD_REQUEST,
                message: `(sellItemsInPOIShop) One ore more checks failed. Please try again.`
            }
        }

        // calculate the total leaderboard points to give to the user per item.
        // if a leaderboard is not specified, we give the points to the most recent leaderboard.
        // if a leaderboard is specified, we give the points to that leaderboard.
        const leaderboardPoints = items.reduce((acc, item) => {
            const globalItems = poiShop.globalItems;
            const playerItems = poiShop.playerItems;

            const globalItem = globalItems.find(globalItem => globalItem.name === item.item);
            const playerItem = playerItems.find(playerItem => playerItem.name === item.item);

            const itemData = globalItem ? globalItem : playerItem;

            // at this point, no need to worry if `leaderboardPoints` is 'unavailable' because it was already checked beforehand.
            return acc + (item.amount * (itemData.sellingPrice.leaderboardPoints as number));
        }, 0);

        // check if leaderboard is specified
        // if not, we find the most recent one.
        const leaderboard = leaderboardName === null ?
            await LeaderboardModel.findOne().sort({ startTimestamp: -1 }) :
            await LeaderboardModel.findOne({ name: leaderboardName });

        if (!leaderboard) {
            return {
                status: Status.BAD_REQUEST,
                message: `(sellItemsInPOIShop) Leaderboard not found.`
            }
        }

        // check if user exists in leaderboard. if not, we create a new user data.
        const userExistsInLeaderboard = leaderboard.userData.find(userData => userData.userId === user._id);

        if (!userExistsInLeaderboard) {
            let additionalPoints = 0;

            // check if this is enough to level the user up to the next player level.
            const currentLevel = user.inGameData.level;
            // use `leaderboardPoints` since the user has just created a new user instance in the leaderboard
            // meaning that they prev had no points.
            const newLevel = GET_SEASON_0_PLAYER_LEVEL(leaderboardPoints);

            // if new level is greater than the current level, we update the user's data
            // 1. set the new level
            // 2. increment the `additionalPoints` to give the user in the leaderboard
            if (newLevel > currentLevel) {
                userUpdateOperations.$set[`inGameData.level`] = newLevel;
                additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
            }

            leaderboardUpdateOperations.$push = {
                'userData': {
                    userId: user._id,
                    twitterProfilePicture: user.twitterProfilePicture,
                    pointsData: [{
                        points: leaderboardPoints,
                        source: LeaderboardPointsSource.RESOURCE_SELLING
                    }],
                    additionalPoints
                }
            }

            // if user has a squad, add the points to the squad's `totalSquadPoints` as well.
            if (squadId) {
                squadUpdateOperations.$inc[`totalSquadPoints`] = leaderboardPoints;

                // get the latest week of the squad leaderboard
                const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

                // if no leaderboard exists somehow, return an error
                if (!latestSquadLeaderboard) {
                    return {
                        status: Status.BAD_REQUEST,
                        message: `(sellItemsInPOIShop) Squad leaderboard not found.`
                    }
                }

                // check if the squad exists in the leaderboard's `pointsData`. if not, we create a new instance.
                const squadIndex = latestSquadLeaderboard.pointsData.findIndex(pointsData => pointsData.squadId === squadId);

                // if not found, we create a new instance.
                if (squadIndex === -1) {
                    squadLeaderboardUpdateOperations.$push[`pointsData`] = {
                        squadId,
                        memberPoints: [{
                            userId: user._id,
                            points: leaderboardPoints
                        }]
                    }
                } else {
                    // otherwise, we increment the user's points in the squad leaderboard.
                    const userIndex = latestSquadLeaderboard.pointsData[squadIndex].memberPoints.findIndex(memberPoints => memberPoints.userId === user._id);

                    // if user is not found, we create a new instance.
                    if (userIndex === -1) {
                        squadLeaderboardUpdateOperations.$push[`pointsData.${squadIndex}.memberPoints`] = {
                            userId: user._id,
                            points: leaderboardPoints
                        }
                    } else {
                        squadLeaderboardUpdateOperations.$inc[`pointsData.${squadIndex}.memberPoints.${userIndex}.points`] = leaderboardPoints;
                    }
                }
            }
        } else {
            let additionalPoints = 0;

            // check if this is enough to level the user up to the next player level.
            const currentLevel = user.inGameData.level;
            // get the user's total leaderboard points
            // this is done by summing up all the points from the `pointsData` array, BUT EXCLUDING SOURCES FROM:
            // 1. LeaderboardPointsSource.LEVELLING_UP
            const totalLeaderboardPoints = userExistsInLeaderboard.pointsData.reduce((acc, pointsData) => {
                if (pointsData.source !== LeaderboardPointsSource.LEVELLING_UP) {
                    return acc + pointsData.points;
                }

                return acc;
            }, 0);

            const newLevel = GET_SEASON_0_PLAYER_LEVEL(leaderboardPoints + totalLeaderboardPoints);

            // if new level is greater than the current level, we update the user's data
            // 1. set the new level
            // 2. increment the `additionalPoints` to give the user in the leaderboard
            if (newLevel > currentLevel) {
                userUpdateOperations.$set[`inGameData.level`] = newLevel;
                additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
            }

            // get the index of the user in the leaderboard
            const userIndex = leaderboard.userData.findIndex(userData => userData.userId === user._id);

            // increment the user's points for source `LeaderboardPointsSource.RESOURCE_SELLING`
            // additionally, if the user did get additionalPoints (i.e. they levelled up), we increment the source LEVELLING_UP as well.
            const resourceSellingIndex = leaderboard.userData[userIndex].pointsData.findIndex(pointsData => pointsData.source === LeaderboardPointsSource.RESOURCE_SELLING);
            const levellingUpIndex = leaderboard.userData[userIndex].pointsData.findIndex(pointsData => pointsData.source === LeaderboardPointsSource.LEVELLING_UP);

            if (resourceSellingIndex === -1) {
                leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                    points: leaderboardPoints,
                    source: LeaderboardPointsSource.RESOURCE_SELLING
                }
            } else {
                leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${resourceSellingIndex}.points`] = leaderboardPoints;
            }

            if (additionalPoints > 0) {
                if (levellingUpIndex === -1) {
                    leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                        points: additionalPoints,
                        source: LeaderboardPointsSource.LEVELLING_UP
                    }
                } else {
                    leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${levellingUpIndex}.points`] = additionalPoints;
                }
            }

            // add the points to the squad's `totalSquadPoints` as well (excluding the additional points)
            if (squadId) {
                squadUpdateOperations.$inc[`totalSquadPoints`] = leaderboardPoints;

                // get the latest week of the squad leaderboard
                const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

                // if no leaderboard exists somehow, return an error
                if (!latestSquadLeaderboard) {
                    return {
                        status: Status.BAD_REQUEST,
                        message: `(sellItemsInPOIShop) Squad leaderboard not found.`
                    }
                }

                // check if the squad exists in the leaderboard's `pointsData`. if not, we create a new instance.
                const squadIndex = latestSquadLeaderboard.pointsData.findIndex(pointsData => pointsData.squadId === squadId);

                // if not found, we create a new instance.
                if (squadIndex === -1) {
                    squadLeaderboardUpdateOperations.$push[`pointsData`] = {
                        squadId,
                        memberPoints: [{
                            userId: user._id,
                            points: leaderboardPoints
                        }]
                    }
                } else {
                    // otherwise, we increment the user's points in the squad leaderboard.
                    const userIndex = latestSquadLeaderboard.pointsData[squadIndex].memberPoints.findIndex(memberPoints => memberPoints.userId === user._id);

                    // if user is not found, we create a new instance.
                    if (userIndex === -1) {
                        squadLeaderboardUpdateOperations.$push[`pointsData.${squadIndex}.memberPoints`] = {
                            userId: user._id,
                            points: leaderboardPoints
                        }
                    } else {
                        squadLeaderboardUpdateOperations.$inc[`pointsData.${squadIndex}.memberPoints.${userIndex}.points`] = leaderboardPoints;
                    }
                }
            }
        }

        // total weight from the user's inventory to reduce if resources are removed.
        let totalWeightToReduce = 0;

        // do two things:
        // 1. update the user's inventory
        // 2. update the shop's data.
        items.forEach(item => {
            if (
                item.item === POIShopItemName.SEAWEED ||
                item.item === POIShopItemName.STONE ||
                item.item === POIShopItemName.COPPER ||
                item.item === POIShopItemName.IRON ||
                item.item === POIShopItemName.SILVER ||
                item.item === POIShopItemName.GOLD ||
                item.item === POIShopItemName.BLUEBERRY ||
                item.item === POIShopItemName.APPLE ||
                item.item === POIShopItemName.STAR_FRUIT ||
                item.item === POIShopItemName.MELON ||
                item.item === POIShopItemName.DRAGON_FRUIT ||
                item.item === POIShopItemName.WATER ||
                item.item === POIShopItemName.MAPLE_SYRUP ||
                item.item === POIShopItemName.HONEY ||
                item.item === POIShopItemName.MOONLIGHT_DEW ||
                item.item === POIShopItemName.PHOENIX_TEAR
            ) {
                // get the index of the resource in the user's inventory
                const resourceIndex = (user.inventory.resources as ExtendedResource[]).findIndex(resource => resource.type === item.item as string);

                // if the resource is not found, return an error.
                if (resourceIndex === -1) {
                    return {
                        status: Status.BAD_REQUEST,
                        message: `(sellItemsInPOIShop) Resource not found in user's inventory.`
                    }
                }

                // if the amount to sell is equal to the amount in the user's inventory, we remove the entire resource.
                // otherwise, we decrement the amount of the resource.
                if (item.amount === (user.inventory.resources as ExtendedResource[])[resourceIndex].amount) {
                    userUpdateOperations.$pull[`inventory.resources`] = { type: item.item };
                } else {
                    userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = -item.amount;
                }

                // calculate the total weight of the resources to reduce the user's inventory by
                totalWeightToReduce += (user.inventory.resources as ExtendedResource[])[resourceIndex].weight * item.amount;
            } else if (
                item.item === POIShopItemName.CANDY ||
                item.item === POIShopItemName.CHOCOLATE ||
                item.item === POIShopItemName.JUICE ||
                item.item === POIShopItemName.BURGER
            ) {
                // get the index of the food in the user's inventory
                const foodIndex = (user.inventory.foods as Food[]).findIndex(food => food.type === item.item as string);

                // if the food is not found, return an error.
                if (foodIndex === -1) {
                    return {
                        status: Status.BAD_REQUEST,
                        message: `(sellItemsInPOIShop) Food not found in user's inventory.`
                    }
                }

                // if the amount to sell is equal to the amount in the user's inventory, we remove the entire food.
                // otherwise, we decrement the amount of the food.
                if (item.amount === (user.inventory.foods as Food[])[foodIndex].amount) {
                    userUpdateOperations.$pull[`inventory.foods`] = { type: item.item };
                } else {
                    userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = -item.amount;
                    userUpdateOperations.$set = {
                        'inventory.foods.$[food].amount': {
                            $gte: 0
                        }
                    }
                }
            } else if (item.item === POIShopItemName.TERRA_CAPSULATOR_I) {
                // get the index of the terra capsulator in the user's inventory
                const terraCapsulatorIndex = (user.inventory.items as Item[]).findIndex(i => i.type === item.item as string);

                // if not found, return an error.
                if (terraCapsulatorIndex === -1) {
                    return {
                        status: Status.BAD_REQUEST,
                        message: `(sellItemsInPOIShop) Terra capsulator type not found in user's inventory.`
                    }
                }

                // if the amount to sell is equal to the amount in the user's inventory, we remove the entire terra capsulator.
                // otherwise, we decrement the amount of the terra capsulator.
                if (item.amount === (user.inventory.items as Item[])[terraCapsulatorIndex].amount) {
                    userUpdateOperations.$pull[`inventory.items`] = { type: item.item };
                } else {
                    userUpdateOperations.$inc[`inventory.items.${terraCapsulatorIndex}.amount`] = -item.amount;
                }
            } else if (item.item === POIShopItemName.BIT_ORB_I) {
                // get the index of the bit orb in the user's inventory
                const bitOrbIndex = (user.inventory.items as Item[]).findIndex(i => i.type === item.item as string);

                // if not found, return an error.
                if (bitOrbIndex === -1) {
                    return {
                        status: Status.BAD_REQUEST,
                        message: `(sellItemsInPOIShop) Bit orb type not found in user's inventory.`
                    }
                }

                // if the amount to sell is equal to the amount in the user's inventory, we remove the entire bit orb.
                // otherwise, we decrement the amount of the bit orb.
                if (item.amount === (user.inventory.items as Item[])[bitOrbIndex].amount) {
                    userUpdateOperations.$pull[`inventory.items`] = { type: item.item };
                } else {
                    userUpdateOperations.$inc[`inventory.items.${bitOrbIndex}.amount`] = -item.amount;
                }
            }

            // now, we update the shop's data.
            // we check if it's a global item.
            // if it's a global item, we find the index of the item in the `globalItems` array and reduce the `sellableAmount` of that item by the amount the user wants to sell.
            // if it's a player item, we:
            // 1. find the index of the item in the `playerItems` array.
            // 2. check if the user exists in the `userTransactionData`. if not, we add a new one.
            // 3. if the user exists, we increment the `soldAmount` by the amount the user wants to sell.
            const globalItems = poiShop.globalItems;
            const playerItems = poiShop.playerItems;

            const globalItem = globalItems.find(globalItem => globalItem.name === item.item);
            const playerItem = playerItems.find(playerItem => playerItem.name === item.item);

            if (globalItem) {
                const globalItemIndex = globalItems.findIndex(globalItem => globalItem.name === item.item);

                poiUpdateOperations.$inc[`shop.globalItems.${globalItemIndex}.sellableAmount`] = -item.amount;
            } else if (playerItem) {
                const playerItemIndex = playerItems.findIndex(playerItem => playerItem.name === item.item);
                const userTransactionDataIndex = playerItem.userTransactionData.findIndex(transactionData => transactionData.userId === user._id);

                if (userTransactionDataIndex === -1) {
                    poiUpdateOperations.$push[`shop.playerItems.${playerItemIndex}.userTransactionData`] = {
                        userId: user._id,
                        soldAmount: item.amount
                    }
                } else {
                    poiUpdateOperations.$inc[`shop.playerItems.${playerItemIndex}.userTransactionData.${userTransactionDataIndex}.soldAmount`] = item.amount;
                }
            }
        });

        // lastly, reduce the user inventory's weight by `totalWeightToReduce`
        userUpdateOperations.$inc[`inventory.weight`] = -totalWeightToReduce;

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations).catch((err) => {
                return {
                    status: Status.ERROR,
                    message: `(sellItemsInPOIShop) Error updating user model: ${err.message}`
                }

            }),
            LeaderboardModel.updateOne({ _id: leaderboard._id }, leaderboardUpdateOperations).catch((err) => {
                return {
                    status: Status.ERROR,
                    message: `(sellItemsInPOIShop) Error updating leaderboard model: ${err.message}`
                }
            }),
            POIModel.updateOne({ name: user.inGameData.location }, poiUpdateOperations).catch((err) => {
                return {
                    status: Status.ERROR,
                    message: `(sellItemsInPOIShop) Error updating POI model: ${err.message}`
                }
            })
        ]);

        // if the user is in a squad, update the squad's total points.
        if (squadId) {
            await SquadModel.updateOne({ _id: squadId }, squadUpdateOperations).catch((err) => {
                return {
                    status: Status.ERROR,
                    message: `(sellItemsInPOIShop) Error updating squad model: ${err.message}`
                }
            });

            // also, get the latest squad leaderboard (sort by -1) and update the squad's memberPoints.
            const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

            if (!latestSquadLeaderboard) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(sellItemsInPOIShop) Squad leaderboard not found.`
                }
            }

            await SquadLeaderboardModel.updateOne({ _id: latestSquadLeaderboard._id }, squadLeaderboardUpdateOperations).catch((err) => {
                return {
                    status: Status.ERROR,
                    message: `(sellItemsInPOIShop) Error updating squad leaderboard model: ${err.message}`
                }
            });
        }

        // check if the user update operations included a level up
        const setUserLevel = userUpdateOperations.$set['inGameData.level'];

        // if it included a level, check if it's set to 3.
        // if it is, check if the user has a referrer.
        // the referrer will then have this user's `hasReachedLevel3` set to true.
        if (setUserLevel && setUserLevel === 3) {
            // check if the user has a referrer
            const referrerId: string | null = user.inviteCodeData.referrerId;

            if (referrerId) {
                // update the referrer's referred users data where applicable
                const { status, message } = await updateReferredUsersData(
                    referrerId,
                    user._id
                );

                if (status === Status.ERROR) {
                    return {
                        status,
                        message: `(claimDailyRewards) Err from updateReferredUsersData: ${message}`
                    }
                }
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(sellItemsInPOIShop) Items sold. Leaderboard points added.`,
            data: {
                leaderboardPoints
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(sellItemsInPOIShop) ${err.message}`
        }
    }
}

/**
 * (User) Buys 1 or more items in the POI's shop.
 */
export const buyItemsInPOIShop = async (
    twitterId: string,
    items: POIShopActionItemData[],
    paymentChoice: 'xCookies' | 'cookieCrumbs'
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const poiUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(buyItemsInPOIShop) User not found.`
            }
        }

        // check if at least 1 item is present and that the amount of that item is at least 1.
        if (items.length === 0 || items.some(item => item.amount < 1)) {
            return {
                status: Status.BAD_REQUEST,
                message: `(buyItemsInPOIShop) At least 1 item must be bought.`
            }
        }

        // get the user's current location to get the POI shop.
        const { status, message, data } = await getCurrentPOI(twitterId);

        if (status !== Status.SUCCESS) {
            return {
                status,
                message
            }
        }

        const poiShop = data.currentPOI.shop as POIShop;

        // get the total payment the user has to make.
        let totalPayment = 0;

        // check if:
        // 1. 1 or more items are not available in the POI shop (cannot be found)
        // 2. 1 or more items have a buyableAmount of 0
        // 3. 1 or more items have a buyableAmount less than the amount the user wants to buy
        // 4. depending on the payment method, check if despite having a buyableAmount > 0 if the xCookies/cookie crumbs value of the item is unavailable.
        // 5. the user doesn't have the amount of xCookies/cookie crumbs they need to buy the item (for any of the specified items)
        // if one of these conditions are met, return an error.
        const invalidItems = items.filter(item => {
            const globalItems = poiShop.globalItems;
            const playerItems = poiShop.playerItems;

            const globalItem = globalItems.find(globalItem => globalItem.name === item.item);
            const playerItem = playerItems.find(playerItem => playerItem.name === item.item);

            // if not available as a global item or player item, return true
            if (!globalItem && !playerItem) {
                return true;
            }

            const itemData = globalItem ? globalItem : playerItem;

            // if the item is a global item, check if `buyableAmount` is 0.
            // if it is, return true.
            if (globalItem && globalItem.buyableAmount === 0) {
                return true;
            }

            // if the item is a player item, check if:
            // 1. the buyableAmount is 0.
            // 2. if not, check if the user exists in `userTransactionData`.
            // 3. if the user exists, check how many of this item the user has bought so far via `boughtAmount`.
            // 4. if `buyableAmount` - `boughtAmount` is less than the amount the user wants to buy, return true.
            if (playerItem) {
                if (playerItem.buyableAmount === 0) {
                    return true;
                }

                const userTransactionData = playerItem.userTransactionData.find(transactionData => transactionData.userId === user._id);

                if (userTransactionData) {
                    const boughtAmount = userTransactionData.boughtAmount;

                    if (playerItem.buyableAmount !== 'infinite' && playerItem.buyableAmount as number - boughtAmount < item.amount) {
                        return true;
                    }
                }
            }

            // check if depending on the payment method, the xCookies/cookie crumbs value of the item is unavailable.
            if (paymentChoice === 'xCookies' && itemData.buyingPrice.xCookies === 'unavailable') {
                return true;
            } else if (paymentChoice === 'cookieCrumbs' && itemData.buyingPrice.cookieCrumbs === 'unavailable') {
                return true;
            }

            // get the total payment the user has to make.
            totalPayment += item.amount * (paymentChoice === 'xCookies' ? itemData.buyingPrice.xCookies as number : itemData.buyingPrice.cookieCrumbs as number);
        });

        if (invalidItems.length > 0) {
            return {
                status: Status.BAD_REQUEST,
                message: `(buyItemsInPOIShop) One or more checks failed. Please try again.`
            }
        }

        // check if the user has enough xCookies/cookie crumbs to buy the items.
        if (paymentChoice === 'xCookies' && user.inventory.xCookieData.currentXCookies < totalPayment) {
            return {
                status: Status.BAD_REQUEST,
                message: `(buyItemsInPOIShop) User does not have enough xCookies.`
            }
        } else if (paymentChoice === 'cookieCrumbs' && user.inventory.cookieCrumbs < totalPayment) {
            return {
                status: Status.BAD_REQUEST,
                message: `(buyItemsInPOIShop) User does not have enough cookie crumbs.`
            }
        }

        // do two things:
        // 1. update the user's inventory
        // 2. update the shop's data
        items.forEach(item => {
            if (
                item.item === POIShopItemName.SEAWEED ||
                item.item === POIShopItemName.STONE ||
                item.item === POIShopItemName.COPPER ||
                item.item === POIShopItemName.IRON ||
                item.item === POIShopItemName.SILVER ||
                item.item === POIShopItemName.GOLD ||
                item.item === POIShopItemName.BLUEBERRY ||
                item.item === POIShopItemName.APPLE ||
                item.item === POIShopItemName.STAR_FRUIT ||
                item.item === POIShopItemName.MELON ||
                item.item === POIShopItemName.DRAGON_FRUIT ||
                item.item === POIShopItemName.WATER ||
                item.item === POIShopItemName.MAPLE_SYRUP ||
                item.item === POIShopItemName.HONEY ||
                item.item === POIShopItemName.MOONLIGHT_DEW ||
                item.item === POIShopItemName.PHOENIX_TEAR
            ) {
                // check if the resource exists in the user's inventory.
                // if it does, increment the amount of the resource.
                // if it doesn't, add a new resource.
                const resourceIndex = (user.inventory.resources as ExtendedResource[]).findIndex(resource => resource.type === item.item as string);

                if (resourceIndex === -1) {
                    userUpdateOperations.$push[`inventory.resources`] = {
                        type: item.item,
                        amount: item.amount
                    }
                } else {
                    userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = item.amount;
                }
            } else if (
                item.item === POIShopItemName.CANDY ||
                item.item === POIShopItemName.CHOCOLATE ||
                item.item === POIShopItemName.JUICE ||
                item.item === POIShopItemName.BURGER
            ) {
                // check if the food exists in the user's inventory.
                // if it does, increment the amount of the food.
                // if it doesn't, add a new food.
                const foodIndex = (user.inventory.foods as Food[]).findIndex(food => food.type === item.item as string);

                if (foodIndex === -1) {
                    userUpdateOperations.$push[`inventory.foods`] = {
                        type: item.item,
                        amount: item.amount
                    }
                } else {
                    userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = item.amount;
                }
            } else if (item.item === POIShopItemName.TERRA_CAPSULATOR_I) {
                // check if the terra capsulator exists in the user's inventory.
                // if it does, increment the amount of the terra capsulator.
                // if it doesn't, add a new terra capsulator.
                const terraCapsulatorIndex = (user.inventory.items as Item[]).findIndex(i => i.type === item.item as string);

                if (terraCapsulatorIndex === -1) {
                    userUpdateOperations.$push[`inventory.items`] = {
                        type: item.item,
                        amount: item.amount
                    }
                } else {
                    userUpdateOperations.$inc[`inventory.items.${terraCapsulatorIndex}.amount`] = item.amount;
                }
            } else if (item.item === POIShopItemName.BIT_ORB_I) {
                // check if the bit orb exists in the user's inventory.
                // if it does, increment the amount of the bit orb.
                // if it doesn't, add a new bit orb.
                const bitOrbIndex = (user.inventory.items as Item[]).findIndex(i => i.type === item.item as string);

                if (bitOrbIndex === -1) {
                    userUpdateOperations.$push[`inventory.items`] = {
                        type: item.item,
                        amount: item.amount
                    }
                } else {
                    userUpdateOperations.$inc[`inventory.items.${bitOrbIndex}.amount`] = item.amount;
                }
            } else if (
                item.item.includes('Gathering Progress Booster') || 
                item.item.includes('Raft Speed Booster')
            ) {
                // check if the booster exists in the user's inventory.
                // if it does, increment the amount of the booster.
                // if it doesn't, add a new booster.
                const boosterIndex = (user.inventory.items as Item[]).findIndex(i => i.type === item.item as string);

                if (boosterIndex === -1) {
                    userUpdateOperations.$push[`inventory.items`] = {
                        type: item.item,
                        amount: item.amount
                    }
                } else {
                    userUpdateOperations.$inc[`inventory.items.${boosterIndex}.amount`] = item.amount;
                }
            }

            // now, we update the shop's data.
            // we check if it's a global item.
            // if it's a global item, we find the index of the item in the `globalItems` array and reduce the `buyableAmount` of that item by the amount the user wants to buy.
            // if it's a player item, we:
            // 1. find the index of the item in the `playerItems` array.
            // 2. check if the user exists in the `userTransactionData`. if not, we add a new one.
            // 3. if the user exists, we increment the `boughtAmount` by the amount the user wants to buy.
            const globalItems = poiShop.globalItems;
            const playerItems = poiShop.playerItems;

            const globalItem = globalItems.find(globalItem => globalItem.name === item.item);
            const playerItem = playerItems.find(playerItem => playerItem.name === item.item);

            if (globalItem) {
                const globalItemIndex = globalItems.findIndex(globalItem => globalItem.name === item.item);

                poiUpdateOperations.$inc[`shop.globalItems.${globalItemIndex}.buyableAmount`] = -item.amount;
            } else if (playerItem) {
                const playerItemIndex = playerItems.findIndex(playerItem => playerItem.name === item.item);
                const userTransactionDataIndex = playerItem.userTransactionData.findIndex(transactionData => transactionData.userId === user._id);

                if (userTransactionDataIndex === -1) {
                    poiUpdateOperations.$push[`shop.playerItems.${playerItemIndex}.userTransactionData`] = {
                        userId: user._id,
                        boughtAmount: item.amount
                    }
                } else {
                    poiUpdateOperations.$inc[`shop.playerItems.${playerItemIndex}.userTransactionData.${userTransactionDataIndex}.boughtAmount`] = item.amount;
                }
            }

            // deduct the xCookies/cookie crumbs from the user's inventory.
            userUpdateOperations.$inc[`inventory.${paymentChoice}`] = -totalPayment;
        });

        // execute the transactions
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            POIModel.updateOne({ name: user.inGameData.location }, poiUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(buyItemsInPOIShop) Items bought.`,
            data: {
                totalPaid: totalPayment,
                paymentChoice: paymentChoice
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(buyItemsInPOIShop) ${err.message}`
        }
    }
}

/**
 * (User) Gets the `userTransactionData` instance of the user for a POI's shop's player items.
 */
export const getUserTransactionData = async (
    twitterId: string
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getUserTransactionData) User not found.`
            }
        }

        // get the user's _id
        const userId = user._id;

        // get the user's current location to get the POI shop.
        const { status, message, data } = await getCurrentPOI(twitterId);

        if (status !== Status.SUCCESS) {
            return {
                status,
                message
            }
        }

        const poiShop = data.currentPOI.shop as POIShop;

        // get the user's transaction data for the player items in the POI shop.
        const playerItems = poiShop.playerItems;

        const userTransactionData = playerItems.map(playerItem => {
            const userTransactionData = playerItem.userTransactionData.find(transactionData => transactionData.userId === userId);

            return {
                name: playerItem.name,
                userTransactionData: userTransactionData ? userTransactionData : null
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(getUserTransactionData) User transaction data for POI: ${data.currentPOI.name} fetched.`,
            data: {
                userTransactionData
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserTransactionData) ${err.message}`
        }
    }
}