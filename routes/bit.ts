import express from 'express';
import { calcBitCurrentRate, evolveBit, evolveBitInRaft, feedBit, getBits } from '../api/bit';
import { FoodType } from '../models/food';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { RateType } from '../models/island';
import mongoose from 'mongoose';
import { BitSchema } from '../schemas/Bit';

const router = express.Router();

router.post('/evolve_bit_in_raft', async (req, res) => {
    const { bitId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'evolve_bit_in_raft');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await evolveBitInRaft(validateData?.twitterId, bitId);

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

router.post('/evolve_bit', async (req, res) => {
    const { bitId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'evolve_bit');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
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

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'feed_bit');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
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

// current gathering rate for 1 bit
router.get('/get_current_gathering_rate/:bitId', async (req, res) => {
    const { bitId } = req.params;

    const Bit = mongoose.model('Bits', BitSchema, 'Bits');

    try {
        const bit = await Bit.findOne({ bitId: parseInt(bitId) });

        if (!bit) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_gathering_rate) Bit with ID ${bitId} not found.`
            })
        }

        const currentGatheringRate = calcBitCurrentRate(
            RateType.GATHERING,
            bit.farmingStats?.baseGatheringRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.gatheringRateGrowth,
            bit.bitStatsModifiers?.gatheringRateModifiers
        );

        return res.status(200).json({
            status: 200,
            message: `(get_current_gathering_rate) Successfully retrieved current gathering rate for bit with ID ${bitId}.`,
            data: {
                currentGatheringRate
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

// current earning rate for 1 bit
router.get('/get_current_earning_rate/:bitId', async (req, res) => {
    const { bitId } = req.params;

    const Bit = mongoose.model('Bits', BitSchema, 'Bits');

    try {
        const bit = await Bit.findOne({ bitId: parseInt(bitId) });

        if (!bit) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_earning_rate) Bit with ID ${bitId} not found.`
            })
        }

        const currentEarningRate = calcBitCurrentRate(
            RateType.EARNING,
            bit.farmingStats?.baseEarningRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.earningRateGrowth,
            bit.bitStatsModifiers?.earningRateModifiers
        );

        return res.status(200).json({
            status: 200,
            message: `(get_current_earning_rate) Successfully retrieved current earning rate for bit with ID ${bitId}.`,
            data: {
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

export default router;
