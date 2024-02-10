import { Bit, BitRarity } from '../models/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { BASE_GATHERING_RATE, GATHERING_RATE_GROWTH, RANDOMIZE_GENDER } from '../utils/constants/bit';
import { RANDOMIZE_RARITY_FROM_ORB } from '../utils/constants/bitOrb';
import { ReturnValue, Status } from '../utils/retVal';
import { getLatestBitId } from './bit';

/**
 * Randomizes a Bit obtained from a Bit Orb.
 */
export const randomizeBit = async (
    owner: string,
    purchaseDate: number,
    obtainMethod: ObtainMethod,
    totalCookiesSpent: number
): Promise<ReturnValue> => {
    // get the latest bit id from the database
    const { status, message, data } = await getLatestBitId();

    if (status !== Status.SUCCESS) {
        return {
            status,
            message: `(randomizeBit) Error from getLatestBitId: ${message}`
        }
    }
    const latestBitId = data?.latestBitId;

    // get the Bit's rarity based on the probability of obtaining it
    const rarity = RANDOMIZE_RARITY_FROM_ORB();

    // randomize the gender 
    const gender = RANDOMIZE_GENDER();


    // generate and return the Bit. DOESN'T SAVE TO DATABASE YET.
    const bit: Bit = {
        bitId: latestBitId + 1,
        rarity,
        gender,
        owner,
        purchaseDate,
        obtainMethod,
        totalCookiesSpent,
        currentFarmingLevel: 1,
        farmingStats: {
            
        }

    }


}

/**
 * Randomizes the farming stats of a Bit.
 */
export const randomizeFarmingStats = (rarity: BitRarity) => {
    // get the base gathering rate
    const baseGatheringRate = BASE_GATHERING_RATE(rarity);

    // get the gathering rate growth
    const gatheringRateGrowth = GATHERING_RATE_GROWTH(rarity);

    // rand from 0.9 to 1.1 as a multiplier for the base gathering rate to get the current gathering rate from base gathering rate
    const randMultiplier = Math.random() * 0.2 + 0.9;
    const currentGatheringRate = baseGatheringRate * randMultiplier;

    // get the base earning rate
}