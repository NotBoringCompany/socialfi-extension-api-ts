import express from 'express';
import { authMiddleware } from '../middlewares/auth';
import { addBitCosmetics, equipBitCosmetic, equipBitCosmeticSet, fetchOwnedBitCosmetics } from '../api/cosmetic';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
const router = express.Router();

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

router.post('/equip_bit_cosmetic_set', async (req, res) => {
    const { bitId, set } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'equip_bit_cosmetic_set');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            });
        }

        const { status, message, data } = await equipBitCosmeticSet(validateData?.twitterId, bitId, set);

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

router.post('/equip_bit_cosmetic', async (req, res) => {
    const { bitId, cosmeticId } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'equip_bit_cosmetic');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            });
        }

        const { status, message, data } = await equipBitCosmetic(validateData?.twitterId, bitId, cosmeticId);

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

// router.get('/get_cosmetics', validateRequestAuthV2('get_cosmetics'), async (req, res) => {
//   // no need to send from body cuz validateRequestAuthV2 will handle it
//   const { userId } = req.body;
//   try {
//     const { status, message, data } = await getAllUserCosmetics(userId);
//     return res.status(status).json({
//       status,
//       message,
//       data
//     });
//   } catch (err: any) {
//     return res.status(500).json({
//       status: 500,
//       message: err.message
//     })
//   }
// })

// router.get('/costmetic_inventory', validateRequestAuthV2('costmetic_inventory'), async (req, res) => {
//   // no need to send from body cuz validateRequestAuthV2 will handle it
//   const { userId } = req.body;
//   try {
//     const { status, message, data } = await getCosmeticMatch(userId);
//     return res.status(status).json({
//       status,
//       message,
//       data
//     });
//   } catch (err: any) {
//     return res.status(500).json({
//       status: 500,
//       message: err.message
//     })
//   }
// })

// router.get('/get_cosmetics_by_bit/:bitId', validateRequestAuthV2('get_cosmetics_by_bit'), async (req, res) => {
//   const { bitId } = req.params;
//   try {
//     const { status, message, data } = await getCosmeticsByBit(Number(bitId));
//     return res.status(status).json({
//       status,
//       message,
//       data
//     });
//   } catch (err: any) {
//     return res.status(500).json({
//       status: 500,
//       message: err.message
//     })
//   }
// })

// // use cosmetic to bit
// router.put('/equip_cosmetic', validateRequestAuthV2('equip_cosmetic'), async (req, res) => {
//   // no need to send userID from body cuz validateRequestAuthV2 will handle it
//   const { userId, cosmeticId, bitId } = req.body;
//   try {
//     const { status, message, data } = await equipCosmetic(cosmeticId, bitId, userId);
//     return res.status(status).json({
//       status,
//       message,
//       data
//     });
//   } catch (err: any) {
//     return res.status(500).json({
//       status: 500,
//       message: err.message
//     })
//   }
// })

// // un use cosmetic to bit
// router.put('/unequip_cosmetic', validateRequestAuthV2('unequip_cosmetic'), async (req, res) => {
//   // no need to send userID from body cuz validateRequestAuthV2 will handle it
//   const { userId, cosmeticId } = req.body;
//   try {
//     const { status, message, data } = await unequipCosmetic(cosmeticId, userId);
//     return res.status(status).json({
//       status,
//       message,
//       data
//     });
//   } catch (err: any) {
//     return res.status(500).json({
//       status: 500,
//       message: err.message
//     })
//   }
// })

// // use cosmetic multiple cosmetics
// router.put('/batch_equip_cosmetics', validateRequestAuthV2('batch_equip_cosmetics'), async (req, res) => {
//   // no need to send userID from body cuz validateRequestAuthV2 will handle it
//   const { userId, cosmeticIds, bitId } = req.body;
//   try {
//     const { status, message, data } = await batchEquipCosmetics(cosmeticIds, bitId, userId);
//     return res.status(status).json({
//       status,
//       message,
//       data
//     });
//   } catch (err: any) {
//     return res.status(500).json({
//       status: 500,
//       message: err.message
//     })
//   }
// })

export default router