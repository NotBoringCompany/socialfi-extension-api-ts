import express from 'express';
import { applyGatheringProgressBooster, applyIslandTapping, calcEffectiveResourceDropChances, calcIslandCurrentRate, checkCurrentTax, claimResources, claimXCookiesAndCrumbs, evolveIsland, getIslandTappingData, getIslands, giftXterioIsland, placeBit, removeIsland, rerollBonusMilestoneReward, unplaceBit, updateGatheringProgressAndDropResourceAlt } from '../api/island';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { IslandType, RateType, ResourceDropChanceDiff } from '../models/island';
import { Modifier } from '../models/modifier';
import { ISLAND_EVOLUTION_COST, MAX_ISLAND_LEVEL } from '../utils/constants/island';;
import { BitModel, IslandModel } from '../utils/constants/db';
import { getBits } from '../api/bit';
import { Bit } from '../models/bit';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { authMiddleware } from '../middlewares/auth';
import { getMainWallet } from '../api/user';
import { APPLY_GATHERING_BOOSTER_MIXPANEL_EVENT_HASH, APPLY_ISLAND_MILESTONE, CLAIM_RESOURCES_MIXPANEL_EVENT_HASH, EVOLVE_ISLAND_MIXPANEL_EVENT_HASH, PLACE_BIT_MIXPANEL_EVENT_HASH, REMOVE_ISLAND_MIXPANEL_EVENT_HASH, REROLL_ISLAND_MILESTONE_BONUS, UNPLACE_BIT_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { incrementEventCounterInContract } from '../api/web3';
import { QuestRequirementType } from '../models/quest';
import { incrementProgressionByType } from '../api/quest';

const router = express.Router();

router.post('/gift_xterio_island', authMiddleware(3), async (req, res) => {
    const { twitterId } = req.body;

    try {
        const { status, message, data } = await giftXterioIsland(twitterId);

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

        if (status === Status.SUCCESS) {
            if (allowMixpanel) {
                mixpanel.track('Place Bit', {
                    distinct_id: validateData?.twitterId,
                    '_data': data,
                });
    
                // increment the event counter in the wonderbits contract.
                incrementEventCounterInContract(validateData?.twitterId, PLACE_BIT_MIXPANEL_EVENT_HASH);
            }

            incrementProgressionByType(QuestRequirementType.PLACE_BIT, validateData?.twitterId, 1);
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

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Unplace Bit', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });

            // increment the event counter in the wonderbits contract.
            incrementEventCounterInContract(validateData?.twitterId, UNPLACE_BIT_MIXPANEL_EVENT_HASH);
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

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Remove Island', {
                distinct_id: validateData?.twitterId,
                '_data': data
            });

            // increment the event counter in the wonderbits contract.
            incrementEventCounterInContract(validateData?.twitterId, REMOVE_ISLAND_MIXPANEL_EVENT_HASH);
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

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Currency Tracker', {
                distinct_id: validateData?.twitterId,
                '_type': 'Evolve Island',
                '_data': data,
            });

            // increment the event counter in the wonderbits contract.
            incrementEventCounterInContract(validateData?.twitterId, EVOLVE_ISLAND_MIXPANEL_EVENT_HASH);
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
        
        // if (status === Status.SUCCESS && allowMixpanel) {
        //     mixpanel.track('Claim Cookies & Crumbs', {
        //         distinct_id: validateData?.twitterId,
        //         '_data': data,
        //     });
        // }

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
            
        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Claim Resources', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });

            // increment the event counter in the wonderbits contract.
            incrementEventCounterInContract(validateData?.twitterId, CLAIM_RESOURCES_MIXPANEL_EVENT_HASH);
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
            <IslandType>island.type,
            bits.map(bit => bit.farmingStats?.baseGatheringRate),
            bits.map(bit => bit.currentFarmingLevel),
            bits.map(bit => bit.farmingStats?.gatheringRateGrowth),
            bits.map(bit => bit.bitStatsModifiers?.gatheringRateModifiers),
            island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]
        );

        const currentEarningRate = calcIslandCurrentRate(
            RateType.EARNING,
            <IslandType>island.type,
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
});

router.post('/apply_gathering_progress_booster', async (req, res) => {
    const { islandId, boosters } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'apply_gathering_progress_booster');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await applyGatheringProgressBooster(validateData?.twitterId, islandId, boosters);

        if (status === Status.SUCCESS) {
            if (allowMixpanel) {
                mixpanel.track('Apply Gathering Booster', {
                    distinct_id: validateData?.twitterId,
                    '_data': data,
                });

                // increment the event counter in the wonderbits contract.
                incrementEventCounterInContract(validateData?.twitterId, APPLY_GATHERING_BOOSTER_MIXPANEL_EVENT_HASH);
            }

            incrementProgressionByType(QuestRequirementType.USE_GATHERING_BOOSTER, validateData?.twitterId, boosters?.length ?? 1);
        }

        return res.status(status).json({
            status,
            message,
            data
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
})

router.post('/update_gathering_progress_and_drop_resource_alt', async (req, res) => {
    const { islandId } = req.body;
    
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'update_gathering_progress_and_drop_resource_alt');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await updateGatheringProgressAndDropResourceAlt(validateData?.twitterId, islandId);

        return res.status(status).json({
            status,
            message,
            data
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
});

router.get('/calc_island_current_rate/:islandId/:rateType', async (req, res) => {
    const { islandId, rateType } = req.params;

    try {
        const island = await IslandModel.findOne({ islandId }).lean();

        if (!island) {
            return res.status(404).json({
                status: 404,
                message: `(calc_island_current_rate) Island with ID ${islandId} not found.`
            });
        }

        // get bits placed on island
        const { status: bitStatus, message: bitMessage, data: bitData } = await getBits(island.placedBitIds as number[]);

        if (bitStatus !== 200) {
            return res.status(bitStatus).json({
                status: bitStatus,
                message: bitMessage
            });
        }

        const bits = bitData?.bits as Bit[];

        // get the island data
        const islandType = <IslandType>island.type;

        const currentRate = calcIslandCurrentRate(
            <RateType>rateType,
            islandType,
            bits.map(bit => bit.farmingStats?.baseGatheringRate),
            bits.map(bit => bit.currentFarmingLevel),
            bits.map(bit => bit.farmingStats?.gatheringRateGrowth),
            bits.map(bit => bit.bitStatsModifiers?.gatheringRateModifiers),
            island.islandStatsModifiers?.gatheringRateModifiers as Modifier[]
        );

        return res.status(200).json({
            status: 200,
            message: `(calc_island_current_rate) Successfully calculated current rate for island with ID ${islandId}.`,
            data: {
                currentRate
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
})

router.get('/get_island_tapping_data/:islandId', async (req, res) => {
    const { islandId } = req.params;

    try {
        const { status: validateStatus, message: validateMessage } = await validateRequestAuth(req, res, 'get_island_tapping_data');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getIslandTappingData(parseInt(islandId));
        
        return res.status(status).json({
            status,
            message,
            data,
        })
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
})

router.post('/reroll_bonus_milestone_reward', async (req, res) => {
    const { islandId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'apply_island_tapping_data');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await rerollBonusMilestoneReward(validateData?.twitterId, parseInt(islandId));

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Reroll Milestone Bonus', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });

            // increment the event counter in the wonderbits contract.
            incrementEventCounterInContract(validateData?.twitterId, REROLL_ISLAND_MILESTONE_BONUS);
        }
        
        return res.status(status).json({
            status,
            message,
            data,
        })
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
})

router.post('/apply_island_tapping_data', async (req, res) => {
    const { islandId, caressMeter, bonus }= req.body;
    
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'apply_island_tapping_data');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await applyIslandTapping(validateData?.twitterId, parseInt(islandId), parseInt(caressMeter), bonus);

        if (status === Status.SUCCESS) {
            if (allowMixpanel) {
                mixpanel.track('Apply Island Milestone', {
                    distinct_id: validateData?.twitterId,
                    '_data': data,
                });
    
                // increment the event counter in the wonderbits contract.
                incrementEventCounterInContract(validateData?.twitterId, APPLY_ISLAND_MILESTONE);
            }

            incrementProgressionByType(QuestRequirementType.TAPPING_MILESTONE, validateData?.twitterId, 1);
        }
        
        return res.status(status).json({
            status,
            message,
            data,
        })
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
})

export default router;