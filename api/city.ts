import { CityName, CityShop } from '../models/city';
import { CityModel, RaftModel, UserModel } from '../utils/constants/db';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a new city to the database. Only callable by admin.
 */
export const addCity = async (
    name: CityName,
    distanceTo: { [destination in CityName]: number },
    shop: CityShop,
    adminKey: string
): Promise<ReturnValue> => {
    if (adminKey !== process.env.ADMIN_KEY) {
        throw new Error(`Invalid admin key.`);
    }

    try {
        // check if a city with the existing city name already exists
        const existingCity = await CityModel.findOne({ name });

        if (existingCity) {
            return {
                status: Status.BAD_REQUEST,
                message: `(addCity) City already exists.`
            }
        }

        // create a new city
        const newCity = new CityModel({
            name,
            distanceTo,
            shop
        });

        await newCity.save();

        return {
            status: Status.SUCCESS,
            message: `(addCity) City added. Name: ${name}`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addCity) ${err.message}`
        }
    }
}

/**
 * (User) Travels to a different city. Requires time.
 */
export const travelToCity = async (
    twitterId: string,
    destination: CityName
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(travelToCity) User not found.`
            }
        }

        // get the current city the user is in
        const currentCity: CityName = user.inGameData.location;

        if (currentCity === destination) {
            return {
                status: Status.BAD_REQUEST,
                message: `(travelToCity) User is already in ${destination}.`
            }
        }

        // get the user's raft and current city data
        const [raft, currentCityData] = await Promise.all([
            RaftModel.findOne({ raftId: user.inventory.raftId }).lean(),
            CityModel.findOne({ name: currentCity }).lean()
        ]);

        const distanceToDestination = currentCityData.distanceTo[destination];

        // get the raft speed
        const raftSpeed = raft.stats.speed;

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
                'inGameData.destinationArrival': currentTime + timeToTravel
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(travelToCity) Travelling to ${destination}. Arrival in ${timeToTravel} seconds.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(travelToCity) ${err.message}`
        }
    }
}

/**
 * Checks, for each user that was/is travelling to another city, if they have arrived at their destination.
 * 
 * Should be called by a scheduler every 5 minutes.
 */
export const checkArrival = async (): Promise<void> => {
    try {
        const currentTime = Math.floor(Date.now() / 1000);

        // get all users that are travelling to another city (i.e. inGameData.travellingTo is not null (but rather contains a city name))
        const users = await UserModel.find({ 'inGameData.travellingTo': { $ne: null } }).lean();

        if (users.length === 0) {
            console.log(`(checkArrival) No users are travelling to another city.`);
            return;
        }

        // prepare bulk write operations
        const bulkWriteOpsPromises = users.map(async user => {
            let updateOperations = [];

            // check if user has arrived at their destination
            if (currentTime >= user.inGameData.destinationArrival) {
                // user has arrived.
                // 1. update travellingTo to null
                // 2. update destinationArrival to 0
                // 3. update location to the destination
                updateOperations.push({
                    updateOne: {
                        filter: { twitterId: user.twitterId },
                        update: {
                            'inGameData.travellingTo': null,
                            'inGameData.destinationArrival': 0,
                            'inGameData.location': user.inGameData.travellingTo
                        }
                    }
                });
            }

            return updateOperations;
        });

        // execute the bulk write operations
        const bulkWriteOpsArrays = await Promise.all(bulkWriteOpsPromises);

        const bulkWriteOps = bulkWriteOpsArrays.flat().filter(op => op);

        // if there are no bulk write operations to execute, return
        if (bulkWriteOps.length === 0) {
            console.error(`(checkArrival) No users to update.`);
            return;
        }

        // execute the bulk write operations
        await UserModel.bulkWrite(bulkWriteOps);

        console.log(`(checkArrival) Updated ${bulkWriteOps.length} users.`);
    } catch (err: any) {
        console.error('Error in checkArrival:', err.message);
    }
}