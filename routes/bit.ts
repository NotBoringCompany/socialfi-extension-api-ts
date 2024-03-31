import express from 'express';
import { calcBitCurrentRate, evolveBit, feedBit, getBits } from '../api/bit';
import { FoodType } from '../models/food';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { RateType } from '../models/island';
import mongoose from 'mongoose';
import { BitSchema } from '../schemas/Bit';
import { BIT_EVOLUTION_COST, FREE_BIT_EVOLUTION_COST } from '../utils/constants/bit';
import { BitModel } from '../utils/constants/db';

const router = express.Router();

router.post('/evolve_bit', async (req, res) => {
    const { bitId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'evolve_bit');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await evolveBit(validateData?.twitterId, bitId);

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.post('/feed_bit', async (req, res) => {
    const { bitId, foodType } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'feed_bit');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await feedBit(validateData?.twitterId, bitId, <FoodType>foodType);

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.get('/get_bits', async (req, res) => {
    const bitIdsParam = req.query.bitIds as string;

    // convert string to array
    const bitIds = bitIdsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

    try {
        const { status, message, data } = await getBits(bitIds);

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

// current gathering and earning rate for 1 bit
router.get('/get_current_rates/:bitId', async (req, res) => {
    const { bitId } = req.params;

    try {
        const bit = await BitModel.findOne({ bitId: parseInt(bitId) }).lean();

        if (!bit) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_rates) Bit with ID ${bitId} not found.`
            })
        }

        const currentGatheringRate = calcBitCurrentRate(
            RateType.GATHERING,
            bit.farmingStats?.baseGatheringRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.gatheringRateGrowth,
            bit.bitStatsModifiers?.gatheringRateModifiers
        );

        const currentEarningRate = calcBitCurrentRate(
            RateType.EARNING,
            bit.farmingStats?.baseEarningRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.earningRateGrowth,
            bit.bitStatsModifiers?.earningRateModifiers
        );

        return res.status(200).json({
            status: 200,
            message: `(get_current_rates) Successfully retrieved current gathering and earning rates for bit with ID ${bitId}.`,
            data: {
                currentGatheringRate,
                currentEarningRate
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

// gets the max current gathering and earning rate (negating any modifiers) for a bit. used mainly for showing max stats during evolution
router.get('/get_max_current_rates/:bitId', async (req, res) => {
    const { bitId } = req.params;

    try {
        const bit = await BitModel.findOne({ bitId: parseInt(bitId) }).lean();

        if (!bit) {
            return res.status(404).json({
                status: 404,
                message: `(get_max_current_rates) Bit with ID ${bitId} not found.`
            })
        }

        const maxGatheringRate = calcBitCurrentRate(
            RateType.GATHERING,
            bit.farmingStats?.baseGatheringRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.gatheringRateGrowth,
            []
        );

        const maxEarningRate = calcBitCurrentRate(
            RateType.EARNING,
            bit.farmingStats?.baseEarningRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.earningRateGrowth,
            []
        );

        return res.status(200).json({
            status: 200,
            message: `(get_max_current_rates) Successfully retrieved max current gathering and earning rates for bit with ID ${bitId}.`,
            data: {
                maxGatheringRate,
                maxEarningRate
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

// get the current gathering and earning rates for a bit when it evolves to the next level (to show users how much the max CGR and CER can grow by)
router.get('/get_next_current_rate_increases/:bitId', async (req, res) => {
    const { bitId } = req.params;

    try {
        const bit = await BitModel.findOne({ bitId: parseInt(bitId) }).lean();

        if (!bit) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_rates) Bit with ID ${bitId} not found.`
            })
        }

        // get the max current gathering and earning rates for the bit (with no modifiers applied)
        const maxCurrentGatheringRate = calcBitCurrentRate(
            RateType.GATHERING,
            bit.farmingStats?.baseGatheringRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.gatheringRateGrowth,
            []
        );

        const maxCurrentEarningRate = calcBitCurrentRate(
            RateType.EARNING,
            bit.farmingStats?.baseEarningRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.earningRateGrowth,
            []
        );

        // get the next max current gathering and earning rates for the bit (with no modifiers applied)
        const nextMaxCurrentGatheringRate = calcBitCurrentRate(
            RateType.GATHERING,
            bit.farmingStats?.baseGatheringRate,
            bit.currentFarmingLevel + 1,
            bit.farmingStats?.gatheringRateGrowth,
            []
        );

        const nextMaxCurrentEarningRate = calcBitCurrentRate(
            RateType.EARNING,
            bit.farmingStats?.baseEarningRate,
            bit.currentFarmingLevel + 1,
            bit.farmingStats?.earningRateGrowth,
            []
        );

        return res.status(200).json({
            status: 200,
            message: `(get_current_rates) Successfully retrieved all rates for bit with ID ${bitId}.`,
            data: {
                maxCurrentGatheringRate,
                maxCurrentEarningRate,
                maxCurrentGatheringRateIncrease: nextMaxCurrentGatheringRate - maxCurrentGatheringRate,
                maxCurrentEarningRateIncrease: nextMaxCurrentEarningRate - maxCurrentEarningRate
            }
        });

    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.get('/get_evolution_cost/:bitId', async (req, res) => {
    const { bitId } = req.params;

    try {
        const bit = await BitModel.findOne({ bitId: parseInt(bitId) }).lean();

        if (!bit) {
            return res.status(404).json({
                status: 404,
                message: `(get_evolution_cost) Bit with ID ${bitId} not found.`
            });
        }

        let evolutionCost = 0;

        if (bit.premium) {
            evolutionCost = BIT_EVOLUTION_COST(bit.currentFarmingLevel);
        } else {
            evolutionCost = FREE_BIT_EVOLUTION_COST(bit.currentFarmingLevel);
        }

        return res.status(200).json({
            status: 200,
            message: `(get_evolution_cost) Successfully retrieved evolution cost for bit with ID ${bitId}.`,
            data: {
                evolutionCost: {
                    xCookie: bit.premium ? evolutionCost : 0,
                    seaweed: bit.premium ? 0 : evolutionCost
                }
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: `(get_evolution_cost) ${err.message}`
        })
    }
});

export default router;
