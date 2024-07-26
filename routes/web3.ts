import express from 'express';
import { checkInviteCodeLinked, claimBeginnerRewards, claimDailyRewards, consumeEnergyPotion, generateSignatureMessage, generateUnlinkSignatureMessage, getBeginnerRewardsData, getInGameData, getInventory, getMainWallet, getUserData, getWalletDetails, linkInviteCode, linkSecondaryWallet, removeResources, unlinkSecondaryWallet } from '../api/user';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { ExtendedProfile } from '../utils/types';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { CLAIM_BEGINNER_REWARDS_MIXPANEL_EVENT_HASH, CLAIM_DAILY_REWARDS_MIXPANEL_EVENT_HASH, LINK_INVITE_CODE_MIXPANEL_EVENT_HASH, REMOVE_RESOURCES_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { UserWallet } from '../models/user';
import { incrementEventCounterInContract, updatePointsInContract } from '../api/web3';

const router = express.Router();

router.post('/update_points_in_contract', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'update_points_in_contract');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await updatePointsInContract(validateData?.twitterId);

        return res.status(status).json({
            status,
            message,
            data
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

router.post('/increment_event_counter_in_contract', async (req, res) => {
    const { mixpanelEventHash } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'increment_event_counter_in_contract');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await incrementEventCounterInContract(validateData?.twitterId, mixpanelEventHash);

        return res.status(status).json({
            status,
            message,
            data
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

export default router;