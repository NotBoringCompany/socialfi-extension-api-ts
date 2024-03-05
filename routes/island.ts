import express from 'express';
import { calcIslandCurrentRate, checkCurrentTax, claimResources, claimXCookies, evolveIsland, getIslands, placeBit } from '../api/island';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import mongoose from 'mongoose';
import { IslandSchema } from '../schemas/Island';
import { BitSchema } from '../schemas/Bit';
import { IslandType, RateType } from '../models/island';
import { Modifier } from '../models/modifier';
import { ISLAND_EVOLUTION_COST } from '../utils/constants/island';

const router = express.Router();

router.post('/place_bit', async (req, res) => {
    const { islandId, bitId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'place_bit');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await placeBit(validateData?.twitterId, islandId, bitId);

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

router.get('/check_current_tax/:twitterId/:islandId', async (req, res) => {
    const { twitterId, islandId } = req.params;

    try {
        const { status, message, data } = await checkCurrentTax(twitterId, parseInt(islandId));

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

router.post('/evolve_island', async (req, res) => {
    const { islandId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'evolve_island');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await evolveIsland(validateData?.twitterId, islandId);

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

router.post('/claim_xcookies', async (req, res) => {
    const { islandId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_xcookies');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await claimXCookies(validateData?.twitterId, islandId);

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

router.post('/claim_resources', async (req, res) => {
    const { islandId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_resources');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await claimResources(validateData?.twitterId, islandId);

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

router.get('/get_islands', async (req, res) => {
    const islandIdsParam = req.query.islandIds as string;

    // convert string to array
    const islandIds = islandIdsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

    try {
        const { status, message, data } = await getIslands(islandIds);

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
})

// get current gathering rate of an island
router.get('/get_current_gathering_rate/:islandId', async (req, res) => {
    const { islandId } = req.params;

    const Island = mongoose.model('Islands', IslandSchema, 'Islands');
    const Bit = mongoose.model('Bits', BitSchema, 'Bits');

    try {
        const island = await Island.findOne({ islandId: parseInt(islandId) });

        if (!island) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_gathering_rate) Island with ID ${islandId} not found.`
            });
        }

        // get the bits placed in the island
        const placedBits = island.placedBitIds as number[];

        // find the bits
        const bits = await Bit.find({ bitId: { $in: placedBits } });

        if (bits.length === 0 || !bits) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_gathering_rate) Bits not found in Island with ID ${islandId}.`
            });
        }

        const currentGatheringRate = calcIslandCurrentRate(
            RateType.GATHERING,
            bits.map(bit => bit.farmingStats?.baseGatheringRate),
            bits.map(bit => bit.currentFarmingLevel),
            bits.map(bit => bit.farmingStats?.gatheringRateGrowth),
            bits.map(bit => bit.bitStatsModifiers?.gatheringRateModifiers),
            island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]
        );

        return res.status(200).json({
            status: 200,
            message: `(get_current_gathering_rate) Successfully retrieved current gathering rate for island with ID ${islandId}.`,
            data: {
                currentGatheringRate
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
})

// get current earning rate of an island
router.get('/get_current_earning_rate/:islandId', async (req, res) => {
    const { islandId } = req.params;

    const Island = mongoose.model('Islands', IslandSchema, 'Islands');
    const Bit = mongoose.model('Bits', BitSchema, 'Bits');

    try {
        const island = await Island.findOne({ islandId: parseInt(islandId) });

        if (!island) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_earning_rate) Island with ID ${islandId} not found.`
            });
        }

        // get the bits placed in the island
        const placedBits = island.placedBitIds as number[];

        // find the bits
        const bits = await Bit.find({ bitId: { $in: placedBits } });

        if (bits.length === 0 || !bits) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_earning_rate) Bits not found in Island with ID ${islandId}.`
            });
        }

        const currentEarningRate = calcIslandCurrentRate(
            RateType.EARNING,
            bits.map(bit => bit.farmingStats?.baseEarningRate),
            bits.map(bit => bit.currentFarmingLevel),
            bits.map(bit => bit.farmingStats?.earningRateGrowth),
            bits.map(bit => bit.bitStatsModifiers?.earningRateModifiers),
            island.islandStatsModifiers?.earningRateModifiers as Modifier[]
        );

        return res.status(200).json({
            status: 200,
            message: `(get_current_earning_rate) Successfully retrieved current earning rate for island with ID ${islandId}.`,
            data: {
                currentEarningRate
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
})

router.get('/get_evolution_cost/:islandId', async (req, res) => {
    const { islandId } = req.params;

    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        const island = await Island.findOne({ islandId: parseInt(islandId) });

        if (!island) {
            return res.status(404).json({
                status: 404,
                message: `(get_evolution_cost) Island with ID ${islandId} not found.`
            });
        }

        const evolutionCost = ISLAND_EVOLUTION_COST(<IslandType>island.type, island.currentLevel);

        return res.status(200).json({
            status: 200,
            message: `(get_evolution_cost) Successfully retrieved evolution cost for island with ID ${islandId}.`,
            data: {
                evolutionCost
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
})

export default router;