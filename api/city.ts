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