import express from 'express';
import { calcSeaweedGatheringRate, claimSeaweed, getRaft, placeBit } from '../api/raft';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { evolveBitInRaft } from '../api/bit';
import mongoose from 'mongoose';
import { UserSchema } from '../schemas/User';
import { RaftSchema } from '../schemas/Raft';
import { BitSchema } from '../schemas/Bit';
import { Bit } from '../models/bit';
import { BitModel, RaftModel, UserModel } from '../utils/constants/db';

const router = express.Router();

router.post('/place_bit', async (req, res) => {
    const { bitId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'place_bit');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

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

router.post('/claim_seaweed', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_seaweed');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimSeaweed(validateData?.twitterId);

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

// since each user only has 1 raft, we can fetch the user's raft by their twitter id
router.get('/get_current_gathering_rate/:twitterId', async (req, res) => {
    const { twitterId } = req.params;

    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_gathering_rate) User not found. Twitter ID: ${twitterId}`
            })
        }

        // get the raft
        const raftId = user.inventory?.raftId;
        const raft = await RaftModel.findOne({ raftId }).lean();

        if (!raft) {
            return res.status(404).json({
                status: 404,
                message: `(get_current_gathering_rate) Raft not found. Raft ID: ${raftId}`
            })
        }

        // get the bits placed in the raft
        const bitIds = raft.placedBitIds as number[];
        const bits = await BitModel.find({ bitId: { $in: bitIds } }).lean();

        // calculate the gathering rate
        const currentGatheringRate = calcSeaweedGatheringRate(bits as Bit[]);

        return res.status(200).json({
            status: 200,
            message: `(get_current_gathering_rate) Gathering rate calculated.`,
            data: {
                currentGatheringRate
            }
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

export default router;