import { Bit, BitFarmingStats, BitRarity } from '../models/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { BASE_ENERGY_DEPLETION_RATE, DEFAULT_EARNING_RATE, DEFAULT_EARNING_RATE_GROWTH, DEFAULT_GATHERING_RATE, DEFAULT_GATHERING_RATE_GROWTH, RANDOMIZE_GENDER } from '../utils/constants/bit';
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
    // get the default gathering rate
    const defaultGatheringRate = DEFAULT_GATHERING_RATE(rarity);
    // get the default gathering rate growth
    const defaultGatheringRateGrowth = DEFAULT_GATHERING_RATE_GROWTH(rarity);
    // get the default earning rate
    const defaultEarningRate = DEFAULT_EARNING_RATE(rarity);
    // get the default earning rate growth
    const defaultEarningRateGrowth = DEFAULT_EARNING_RATE_GROWTH(rarity);
    // get the base energy depletion rate
    const baseEnergyDepletionRate = BASE_ENERGY_DEPLETION_RATE;

    // rand from 0.9 to 1.1 to determine base gathering rate (and also current gathering rate since it's at level 1)
    const randGatheringRate = Math.random() * 0.2 + 0.9;
    const baseGatheringRate = defaultGatheringRate * randGatheringRate;

    // rand from 0.9 to 1.1 to determine gathering rate growth
    const randGatheringRateGrowth = Math.random() * 0.2 + 0.9;
    const gatheringRateGrowth = defaultGatheringRateGrowth * randGatheringRateGrowth;

    // rand from 0.9 to 1.1 to determine base earning rate (and also current earning rate since it's at level 1)
    const randEarningRate = Math.random() * 0.2 + 0.9;
    const baseEarningRate = defaultEarningRate * randEarningRate;

    // rand from 0.9 to 1.1 to determine earning rate growth
    const randEarningRateGrowth = Math.random() * 0.2 + 0.9;
    const earningRateGrowth = defaultEarningRateGrowth * randEarningRateGrowth;

    // rand from 0.75 to 1.25 to determine current energy depletion rate
    const randEnergyDepletionRate = Math.random() * 0.5 + 0.75;
    const currentEnergyDepletionRate = baseEnergyDepletionRate * randEnergyDepletionRate;


    return {
        baseGatheringRate,
        gatheringRateGrowth,
        currentGatheringRate: baseGatheringRate,
        baseEarningRate,
        earningRateGrowth,
        currentEarningRate: baseEarningRate,
        currentEnergyDepletionRate,
        currentEnergy: 100
    }
}