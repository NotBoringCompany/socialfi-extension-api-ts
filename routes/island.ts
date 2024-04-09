import express from 'express';
import { calcEffectiveResourceDropChances, calcIslandCurrentRate, checkCurrentTax, claimResources, claimXCookiesAndCrumbs, evolveIsland, getIslands, placeBit, removeIsland, unplaceBit } from '../api/island';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { IslandType, RateType, ResourceDropChanceDiff } from '../models/island';
import { Modifier } from '../models/modifier';
import { ISLAND_EVOLUTION_COST, MAX_ISLAND_LEVEL } from '../utils/constants/island';;
import { BitModel, IslandModel } from '../utils/constants/db';

const router = express.Router();

router.post('/place_bit', async (req, res) => {
    const { islandId, bitId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'place_bit');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }
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

router.post('/unplace_bit', async (req, res) => {
    const { bitId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'unplace_bit');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await unplaceBit(validateData?.twitterId, bitId);

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

router.post('/remove_island', async (req, res) => {
    const { islandId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'remove_island');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await removeIsland(validateData?.twitterId, islandId);

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
    const { islandId, choice } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'evolve_island');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await evolveIsland(validateData?.twitterId, islandId, choice);

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

router.post('/claim_xcookies_and_crumbs', async (req, res) => {
    const { islandId } = req.body;

    try {

        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_xcookies_and_crumbs');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimXCookiesAndCrumbs(validateData?.twitterId, islandId);

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
    const { islandId, claimType, chosenResources } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_resources');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimResources(
            validateData?.twitterId, 
            islandId,
            claimType,
            chosenResources ?? null
        );

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

// get current gathering and earning rates of an island
router.get('/get_current_rates/:islandId', async (req, res) => {
    const { islandId } = req.params;

    try {
        const island = await IslandModel.findOne({ islandId: parseInt(islandId) }).lean();

        if (!island) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_rates) Island with ID ${islandId} not found.`
            });
        }

        // get the bits placed in the island
        const placedBits = island.placedBitIds as number[];

        // find the bits
        const bits = await BitModel.find({ bitId: { $in: placedBits } }).lean();

        if (bits.length === 0 || !bits) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_rates) Bits not found in Island with ID ${islandId}.`
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
            message: `(get_current_rates) Successfully retrieved current rates for island with ID ${islandId}.`,
            data: {
                currentGatheringRate,
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

    try {
        const island = await IslandModel.findOne({ islandId: parseInt(islandId) }).lean();

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

router.get('/get_x_cookie_tax/:twitterId/:islandId', async (req, res) => {
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
        });
    }
})

router.get('/get_evolution_resource_drop_chances_diff/:islandId', async (req, res) => {
    const { islandId } = req.params;

    try {
        const island = await IslandModel.findOne({ islandId: parseInt(islandId) }).lean();

        if (!island) {
            return res.status(404).json({
                status: 404,
                message: `(get_evolution_resource_drop_chances_diff) Island with ID ${islandId} not found.`
            });
        }

        const currentLevel = island.currentLevel;
        const islandType = <IslandType>island.type;

        const currentResourceDropChances = calcEffectiveResourceDropChances(islandType, currentLevel);

        let nextLevelResourceDropChances: ResourceDropChanceDiff;

        // since islands have a max level, if theyre at max level, the next level resource drop chances will be 0 (because they technically can't level it up anymore)
        if (currentLevel === MAX_ISLAND_LEVEL) {
            nextLevelResourceDropChances = {
                common: 0,
                uncommon: 0,
                rare: 0,
                epic: 0,
                legendary: 0
            }
        } else {
            nextLevelResourceDropChances = calcEffectiveResourceDropChances(<IslandType>island.type, currentLevel + 1);
        }

        const resourceDropChanceDiff: ResourceDropChanceDiff = {
            common: nextLevelResourceDropChances.common - currentResourceDropChances.common,
            uncommon: nextLevelResourceDropChances.uncommon - currentResourceDropChances.uncommon,
            rare: nextLevelResourceDropChances.rare - currentResourceDropChances.rare,
            epic: nextLevelResourceDropChances.epic - currentResourceDropChances.epic,
            legendary: nextLevelResourceDropChances.legendary - currentResourceDropChances.legendary
        }

        return res.status(200).json({
            status: 200,
            message: `(get_evolution_resource_drop_chances_diff) Successfully retrieved resource drop chances difference for island with ID ${islandId}.`,
            data: {
                currentResourceDropChances,
                resourceDropChanceDiff
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