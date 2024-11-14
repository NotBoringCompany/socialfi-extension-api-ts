import express from 'express';
import { consumeBitOrb } from '../api/bitOrb';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { getMainWallet } from '../api/user';
import { incrementProgressionByType } from '../api/quest';
import { QuestRequirementType } from '../models/quest';

const router = express.Router();

router.post('/consume', async (req, res) => {
    const { type } = req.body;
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'consume_bit_orb');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }
        const { status, message, data } = await consumeBitOrb(
            validateData?.twitterId,
            type
        );

        if (status === Status.SUCCESS) {
            if (allowMixpanel) {
                mixpanel.track('Consume Bit Orb', {
                    distinct_id: validateData?.twitterId,
                    '_type': type,
                    '_bit': data?.bit,
                });
            }

            incrementProgressionByType(QuestRequirementType.CONSUME_ORB, validateData?.twitterId, 1);
            incrementProgressionByType(QuestRequirementType.HATCH_BIT, validateData?.twitterId, 1, data.bit.rarity);
        }

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

export default router;
