import express from 'express';
import { evolveRaft, getRaft, placeBit } from '../api/raft';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';

const router = express.Router();

router.post('/place_bit', async (req, res) => {
    const { bitId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'place_bit');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await placeBit(validateData?.twitterId, bitId);

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

router.get('/get_raft/:twitterId', async (req, res) => {
    const { twitterId } = req.params;

    try {
        const { status, message, data } = await getRaft(twitterId);

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

router.post('/evolve_raft', async (req, res) => {
    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'evolve_raft');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await evolveRaft(validateData?.twitterId);

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

export default router;