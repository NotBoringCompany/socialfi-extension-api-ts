import express from 'express';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
import { craftAsset } from '../api/craft';
import { CRAFTING_RECIPES } from '../utils/constants/craft';

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

router.get('/get_craft_assets', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_craft_assets');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        return res.status(200).json({
            status: 200,
            message: 'Succesfully retrieved craftable assets',
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