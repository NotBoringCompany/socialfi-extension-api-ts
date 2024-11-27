import express from 'express';
import { bulkFeedBits, calcBitGatheringRate, feedBit, getBits, giftXterioBit, mintBit, releaseBit, renameBit } from '../api/bit';
import { FoodType } from '../models/food';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { RateType } from '../models/island';
import mongoose from 'mongoose';
import { BitSchema } from '../schemas/Bit';
import { BitModel } from '../utils/constants/db';
import { Modifier } from '../models/modifier';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { authMiddleware } from '../middlewares/auth';
import { DEPLOYER_WALLET, WONDERBITS_CONTRACT, XPROTOCOL_TESTNET_PROVIDER } from '../utils/constants/web3';
import { getMainWallet } from '../api/user';
import { UserWallet } from '../models/user';
import { generateHashSalt } from '../utils/crypto';
import { ethers } from 'ethers';
import { incrementProgressionByType } from '../api/quest';
import { QuestRequirementType } from '../models/quest';
import { calcIslandGatheringRate } from '../api/island';

const router = express.Router();

router.post('/mint_bit', async (req, res) => {
    const { bitId } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'mint_bit');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await mintBit(validateData?.twitterId, bitId);

        return res.status(status).json({
            status,
            message,
            data
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

router.post('/gift_xterio_bit', authMiddleware(3), async (req, res) => {
    const { twitterId } = req.body;

    try {
        const { status, message, data } = await giftXterioBit(twitterId);

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

router.post('/rename_bit', async (req, res) => {
    const { bitId, newName } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'rename_bit');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await renameBit(validateData?.twitterId, bitId, newName);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Rename Bit', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });
        }

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

router.post('/release_bit', async (req, res) => {
    const { bitId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'release_bit');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await releaseBit(validateData?.twitterId, bitId);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Release Bit', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });
        }

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

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Feed Bit', {
                distinct_id: validateData?.twitterId,
                '_data': data
            });

            incrementProgressionByType(QuestRequirementType.FEED_BIT, validateData?.twitterId, 1);
        }

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

router.post('/bulk_feed_bits', async (req, res) => {
    const { userId, foodType, bitIds } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'bulk_feed_bits');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await bulkFeedBits(userId, foodType, bitIds);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Bulk Feed Bit', {
                distinct_id: validateData?.twitterId,
                '_data': data
            });

            incrementProgressionByType(QuestRequirementType.FEED_BIT, validateData?.twitterId, data?.foodUsed ?? 1);
        }

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
router.get('/get_gathering_rate/:bitId', async (req, res) => {
    const { bitId } = req.params;

    try {
        const bit = await BitModel.findOne({ bitId: parseInt(bitId) }).lean();

        if (!bit) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_rates) Bit with ID ${bitId} not found.`
            })
        }

        const currentGatheringRate = calcBitGatheringRate(
            bit.farmingStats?.baseGatheringRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.gatheringRateGrowth,
            bit.bitStatsModifiers?.gatheringRateModifiers
        );

        return res.status(200).json({
            status: 200,
            message: `(get_gathering_rates) Successfully retrieved current gathering rate for bit with ID ${bitId}.`,
            data: {
                currentGatheringRate,
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

// gets the max current gathering rate (negating any modifiers) for a bit. used mainly for showing max stats during evolution
router.get('/get_max_gathering_rate/:bitId', async (req, res) => {
    const { bitId } = req.params;

    try {
        const bit = await BitModel.findOne({ bitId: parseInt(bitId) }).lean();

        if (!bit) {
            return res.status(404).json({
                status: 404,
                message: `(get_max_gathering_rate) Bit with ID ${bitId} not found.`
            })
        }

        // for the modifiers, only get the modifiers impacted by the traits (since it's permanent)
        const gatheringRateTraitsModifiers = (bit.bitStatsModifiers?.gatheringRateModifiers as Modifier[]).filter(modifier => modifier.origin.includes('Trait'));

        const maxGatheringRate = calcBitGatheringRate(
            bit.farmingStats?.baseGatheringRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.gatheringRateGrowth,
            gatheringRateTraitsModifiers
        );

        return res.status(200).json({
            status: 200,
            message: `(get_max_gathering_rate) Successfully retrieved max current gathering rate for bit with ID ${bitId}.`,
            data: {
                maxGatheringRate
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

// get the current gathering rates for a bit when it evolves to the next level (to show users how much the max CGR and CER can grow by)
router.get('/get_next_gathering_rate_increases/:bitId', async (req, res) => {
    const { bitId } = req.params;

    try {
        const bit = await BitModel.findOne({ bitId: parseInt(bitId) }).lean();

        if (!bit) {
            return res.status(404).json({
                status: 404,
                message: `(get_next_gathering_rate_increases) Bit with ID ${bitId} not found.`
            })
        }

        // get the max current gathering rates for the bit (with no modifiers applied)
        const maxCurrentGatheringRate = calcBitGatheringRate(
            bit.farmingStats?.baseGatheringRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.gatheringRateGrowth,
            []
        );

        // get the next max current gathering rates for the bit (with no modifiers applied)
        const nextMaxCurrentGatheringRate = calcBitGatheringRate(
            bit.farmingStats?.baseGatheringRate,
            bit.currentFarmingLevel + 1,
            bit.farmingStats?.gatheringRateGrowth,
            []
        );

        return res.status(200).json({
            status: 200,
            message: `(get_next_gathering_rate_increases) Successfully retrieved all rates for bit with ID ${bitId}.`,
            data: {
                maxCurrentGatheringRate,
                maxCurrentGatheringRateIncrease: nextMaxCurrentGatheringRate - maxCurrentGatheringRate,
            }
        });

    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

export default router;
