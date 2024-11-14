import express from 'express';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
import { cancelCraft, claimCraftedAssets, craftAsset, fetchCraftingQueues } from '../api/craft';
import { CRAFTING_RECIPES } from '../utils/constants/craft';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { IngotEnum, IngotItem } from '../models/item';
import { incrementProgressionByType } from '../api/quest';
import { QuestRequirementType } from '../models/quest';

const router = express.Router();

router.post('/craft_asset', async (req, res) => {
    const { assetToCraft, amount, chosenAssetGroup, chosenFlexibleRequiredAssets } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'craft_asset');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await craftAsset(validateData?.twitterId, assetToCraft, amount, chosenAssetGroup, chosenFlexibleRequiredAssets);
        
        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Craft Asset', {
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
});

router.post('/cancel_craft', async (req, res) => {
    const { craftingQueueId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'cancel_craft');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await cancelCraft(validateData?.twitterId, craftingQueueId);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Currency Tracker', {
                distinct_id: validateData?.twitterId,
                '_type': 'Cancel Crafting Queue',
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

router.get('/get_craftable_assets', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_crafting_assets');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        return res.status(200).json({
            status: 200,
            message: 'Succesfully retrieved craftable assets.',
            data: {
                craftableAssets: CRAFTING_RECIPES,
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.get('/fetch_crafting_queues/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'fetch_crafting_queues');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await fetchCraftingQueues(userId);
        
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

router.post('/claim_crafted_assets', async (req, res) => {
    const { claimType, craftingLine, craftingQueueIds } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_crafted_asset');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimCraftedAssets(validateData?.twitterId, claimType, craftingLine, craftingQueueIds);

        if (status === Status.SUCCESS) {
            if (allowMixpanel) {
                mixpanel.track('Claim Crafted Asset', {
                    distinct_id: validateData?.twitterId,
                    '_data': data,
                });
            }

            const { fullyClaimedCraftingData, partiallyClaimedCraftingData } = data;
            const craftingResult: { queueId: string, craftedAsset: string, claimableAmount: number }[] = [...fullyClaimedCraftingData, ...partiallyClaimedCraftingData];

            craftingResult
                .filter(({ craftedAsset }) => !Object.values(IngotEnum).includes(craftedAsset as any)) // ignore ingot type
                .forEach((item) => {
                    const rarity = CRAFTING_RECIPES.find((recipe) => recipe.craftedAssetData.asset === item.craftedAsset).craftedAssetData.assetRarity;
                    if (!rarity) return;

                    incrementProgressionByType(QuestRequirementType.CRAFT_ITEM, validateData?.twitterId, item.claimableAmount);
                    incrementProgressionByType(QuestRequirementType.CRAFT_ITEM, validateData?.twitterId, item.claimableAmount, rarity);
                });
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
        })
    }
})

// router.post('/do_craft', async (req, res) => {
//     const { resType, amt } = req.body;

//     try {
//         const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'do_craft');

//         if (validateStatus !== Status.SUCCESS) {
//             return res.status(validateStatus).json({
//                 status: validateStatus,
//                 message: validateMessage
//             })
//         }

//         //const { status, message, data } = await feedBit(validateData?.twitterId, bitId, <FoodType>foodType);
//         const { status, message, data } = await doCraft(validateData?.twitterId, resType, amt);
        

//         return res.status(status).json({
//             status,
//             message,
//             data
//         });
//     } catch (err: any) {
//         return res.status(500).json({
//             status: 500,
//             message: err.message
//         })
//     }
// });

export default router;