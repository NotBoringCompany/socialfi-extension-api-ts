import { POIName, POIShop } from '../models/poi';
import { POIModel, RaftModel, UserModel } from '../utils/constants/db';
import { ACTUAL_RAFT_SPEED } from '../utils/constants/raft';
import { ReturnValue, Status } from '../utils/retVal';

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
                shop
            }
        });
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addOrUpdatePOIShop) ${err.message}`
        }
    }
}