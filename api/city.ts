import { CityName, CityShop } from '../models/city';
import { CityModel } from '../utils/constants/db';
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