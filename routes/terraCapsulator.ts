import express from 'express';
import { consumeTerraCapsulator } from '../api/terraCapsulator';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { getMainWallet } from '../api/user';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { CONSUME_TERRA_CAPSULATOR_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { incrementEventCounterInContract } from '../api/web3';
import { incrementProgressionByType } from '../api/quest';
import { QuestRequirementType } from '../models/quest';

const router = express.Router();

router.post('/consume', async (req, res) => {
    const { type } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'consume_terra_capsulator');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await consumeTerraCapsulator(type, validateData?.twitterId);

        if (status === Status.SUCCESS) {
            if (allowMixpanel) {
                mixpanel.track('Consume Terra Capsulator', {
                    distinct_id: validateData?.twitterId,
                    '_type': type,
                    '_island': data?.island,
                });
    
                // increment the event counter in the wonderbits contract.
                incrementEventCounterInContract(validateData?.twitterId, CONSUME_TERRA_CAPSULATOR_MIXPANEL_EVENT_HASH);
            }

            incrementProgressionByType(QuestRequirementType.SUMMON_ISLAND, validateData?.twitterId, 1, data.island.type);
        }

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

export default router;