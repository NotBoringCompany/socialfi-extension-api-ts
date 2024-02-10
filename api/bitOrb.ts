import { Bit, BitFarmingStats, BitRarity } from '../models/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { BASE_EARNING_RATE, BASE_ENERGY_DEPLETION_RATE, BASE_GATHERING_RATE, EARNING_RATE_GROWTH, GATHERING_RATE_GROWTH, RANDOMIZE_GENDER } from '../utils/constants/bit';
import { RANDOMIZE_RARITY_FROM_ORB } from '../utils/constants/bitOrb';
import { ReturnValue, Status } from '../utils/retVal';
import { getLatestBitId } from './bit';

/**
 * Summons a Bit obtained from a Bit Orb.
 */
export const summonBit = async (
    owner: string,
    obtainMethod: ObtainMethod,
    totalCookiesSpent: number
): Promise<ReturnValue> => {
    try {
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


        // summon and return the Bit. DOESN'T SAVE TO DATABASE YET.
        const bit: Bit = {
            bitId: latestBitId + 1,
            rarity,
            gender,
            owner,
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod,
            totalCookiesSpent,
            currentFarmingLevel: 1,
            farmingStats: randomizeFarmingStats(rarity),
            bitStatsModifiers: {
                gatheringRateModifiers: [],
                earningRateModifiers: [],
                energyRateModifiers: []
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(summonBit) Bit randomized and summoned.`,
            data: {
                bit
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(summonBit) Error: ${err.message}`
        }

    }
}

/**
 * Randomizes the farming stats of a Bit.
 */
export const randomizeFarmingStats = (rarity: BitRarity): BitFarmingStats => {
    // get the base gathering rate
    const baseGatheringRate = BASE_GATHERING_RATE(rarity);

    // get the gathering rate growth
    const gatheringRateGrowth = GATHERING_RATE_GROWTH(rarity);

    // rand from 0.9 to 1.1 as a multiplier for the base gathering rate to get the current gathering rate from base gathering rate
    const gatherRateMul = Math.random() * 0.2 + 0.9;
    const currentGatheringRate = baseGatheringRate * gatherRateMul;

    // get the base earning rate
    const baseEarningRate = BASE_EARNING_RATE(rarity);

    // get the earning rate growth
    const earningRateGrowth = EARNING_RATE_GROWTH(rarity);

    // rand from 0.9 to 1.1 as a multiplier for the base earning rate to get the current earning rate from base earning rate
    const earnRateMul = Math.random() * 0.2 + 0.9;
    const currentEarningRate = baseEarningRate * earnRateMul;

    // rand from 0.75 to 1.25 as a multiplier for the base energy depletion rate to get the current energy depletion rate from base energy depletion rate
    const energyDepletionRateMul = Math.random() * 0.5 + 0.75;
    const currentEnergyDepletionRate = BASE_ENERGY_DEPLETION_RATE * energyDepletionRateMul;

    return {
        baseGatheringRate,
        gatheringRateGrowth,
        currentGatheringRate,
        baseEarningRate,
        earningRateGrowth,
        currentEarningRate,
        currentEnergyDepletionRate,
        currentEnergy: 100
    }
}