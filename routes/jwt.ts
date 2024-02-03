import express from 'express';
import { Status } from '../utils/retVal';
import { validateJWT } from '../utils/jwt';

const router = express.Router();

router.post('/validate_jwt', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                status: Status.UNAUTHORIZED,
                message: 'No token provided.'
            });
        }

        const { status, message, data } = validateJWT(token);

        if (status !== Status.SUCCESS) {
            return res.status(status).json({
                status,
                message
            });
        } else {
            return res.status(status).json({
                status,
                message,
                data
            });
        }
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message
        })
    }
});

export default router;