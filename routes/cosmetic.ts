import express from 'express';
import { authMiddleware } from '../middlewares/auth';
import { addBitCosmetics, equipBitCosmetics, fetchOwnedBitCosmetics, unequipBitCosmeticSlots } from '../api/cosmetic';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
const router = express.Router();

router.get('/fetch_owned_bit_cosmetics', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'fetch_owned_bit_cosmetics');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            });
        }

        const { status, message, data } = await fetchOwnedBitCosmetics(validateData?.twitterId);

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

router.post('/add_bit_cosmetics', authMiddleware(3), async (req, res) => {
    const { cosmetics } = req.body;
    try {
        const { status, message, data } = await addBitCosmetics(cosmetics);
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

router.post('/equip_bit_cosmetics', async (req, res) => {
    const { bitId, bitCosmeticIds } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'equip_bit_cosmetic');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            });
        }

        const { status, message, data } = await equipBitCosmetics(validateData?.twitterId, bitId, bitCosmeticIds);

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

router.post('/unequip_bit_cosmetic_slots', async (req, res) => {
    const { bitId, slots } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'unequip_bit_cosmetic_slots');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            });
        }

        const { status, message, data } = await unequipBitCosmeticSlots(validateData?.twitterId, bitId, slots);

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

export default router