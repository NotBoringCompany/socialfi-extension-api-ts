import express from 'express';
import { calcBitGatheringRate, evolveBit, feedBit, getBits, giftXterioBit, releaseBit, renameBit } from '../api/bit';
import { FoodType } from '../models/food';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import mongoose from 'mongoose';
import { BitSchema } from '../schemas/Bit';
import { BIT_EVOLUTION_COST, FREE_BIT_EVOLUTION_COST } from '../utils/constants/bit';
import { BitModel } from '../utils/constants/db';
import { Modifier } from '../models/modifier';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { authMiddleware } from '../middlewares/auth';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { incrementProgressionByType } from '../api/quest';
import { QuestRequirementType } from '../models/quest';

const router = express.Router();

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

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Currency Tracker', {
                distinct_id: validateData?.twitterId,
                '_type': 'Evolve Bit',
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

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Feed Bit', {
                distinct_id: validateData?.twitterId,
                '_data': data
            });

            // increment the event counter in the wonderbits contract.
            

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
                message: `(get_gathering_rate) Bit with ID ${bitId} not found.`
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
            message: `(get_gathering_rate) Successfully retrieved current gathering rate for bit with ID ${bitId}.`,
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
                maxGatheringRate,
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

// get the current gathering rate for a bit when it evolves to the next level (to show users how much the max CGR can grow by)
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

        // get the max current gathering and earning rates for the bit (with no modifiers applied)
        const maxCurrentGatheringRate = calcBitGatheringRate(
            bit.farmingStats?.baseGatheringRate,
            bit.currentFarmingLevel,
            bit.farmingStats?.gatheringRateGrowth,
            bit.bitStatsModifiers?.gatheringRateModifiers
        );

        // get the next max current gathering and earning rates for the bit (with no modifiers applied)
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
