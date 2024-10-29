import express from 'express';
import { equipCosmetic,  getAllUserCosmetics, getCosmeticMatch, getCosmeticsByBit, unequipCosmetic } from '../api/cosmetic';
import { validateRequestAuthV2 } from '../middlewares/validateRequest';
const router = express.Router();

router.get('/get_cosmetics', validateRequestAuthV2('get_cosmetics'), async (req, res) => {
  // no need to send from body cuz validateRequestAuthV2 will handle it
  const { userId } = req.body;
  try {
    const { status, message, data } = await getAllUserCosmetics(userId);
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

router.get('/costmetic_inventory', validateRequestAuthV2('costmetic_inventory'), async (req, res) => {
  // no need to send from body cuz validateRequestAuthV2 will handle it
  const { userId } = req.body;
  try {
    const { status, message, data } = await getCosmeticMatch(userId);
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

router.get('/get_cosmetics_by_bit/:bitId', validateRequestAuthV2('get_cosmetics_by_bit'), async (req, res) => {
  const { bitId } = req.params;
  try {
    const { status, message, data } = await getCosmeticsByBit(Number(bitId));
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

// use cosmetic to bit
router.put('/equip_cosmetic', validateRequestAuthV2('equip_cosmetic'), async (req, res) => {
  // no need to send userID from body cuz validateRequestAuthV2 will handle it
  const { userId, cosmeticId, bitId } = req.body;
  try {
    const { status, message, data } = await equipCosmetic(cosmeticId, bitId, userId);
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

// un use cosmetic to bit
router.put('/unequip_cosmetic', validateRequestAuthV2('unequip_cosmetic'), async (req, res) => {
  // no need to send userID from body cuz validateRequestAuthV2 will handle it
  const { userId, cosmeticId } = req.body;
  try {
    const { status, message, data } = await unequipCosmetic(cosmeticId, userId);
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