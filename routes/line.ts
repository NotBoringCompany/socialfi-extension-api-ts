import express from 'express';
import { authMiddleware } from '../middlewares/auth';
import { getUserByWallet } from '../api/user';

const router = express.Router();

router.get('/address/:userAddress', authMiddleware(3), async (req, res) => {
    const { userAddress } = req.params;

    try {
        const { status, message, data } = await getUserByWallet(userAddress);

        return res.status(status).json({
            status,
            message,
            data: {
                balance: data.user.inventory.xCookieData.currentXCookies
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