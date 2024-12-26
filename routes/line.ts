import express from 'express';
import { authMiddleware } from '../middlewares/auth';
import { getUserByWallet } from '../api/user';
import { Status } from '../utils/retVal';

const router = express.Router();

router.get('/address/:userAddress', authMiddleware(2), async (req, res) => {
    const { userAddress } = req.params;

    try {
        const { status, message, data } = await getUserByWallet(userAddress);
        if (status !== Status.SUCCESS) {
            return res.status(status).json({
                message: message
            });
        }

        return res.status(status).json({
            balance: data.user.inventory.xCookieData.currentXCookies
        });
    } catch (err: any) {
        return res.status(500).json({
            message: err.message
        })
    }

})

export default router;