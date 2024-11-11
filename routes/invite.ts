import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { claimReferralRewards, claimSuccessfulIndirectReferralRewards, fetchSuccessfulIndirectReferralRewards, getReferredUsersKOSCount } from '../api/invite';

import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { CLAIM_INDIRECT_REFERRAL_REWARDS_MIXPANEL_EVENT_HASH, CLAIM_REFERRAL_REWARDS_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';

const router = express.Router();

router.post('/claim_referral_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_referral_rewards');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimReferralRewards(validateData?.twitterId);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Claim Referral Rewards', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });

            // increment the event counter in the wonderbits contract.
            
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
})

router.get('/get_referred_users_kos_count', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_referred_users_kos_count');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await getReferredUsersKOSCount(validateData?.twitterId);

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

router.get('/get_successful_indirect_referral_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_successful_indirect_referral_rewards');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await fetchSuccessfulIndirectReferralRewards(validateData?.twitterId);

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

router.post('/claim_successful_indirect_referral_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_successful_indirect_referral_rewards');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimSuccessfulIndirectReferralRewards(validateData?.twitterId);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Claim Indirect Referral Rewards', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });

            // increment the event counter in the wonderbits contract.
            
        }

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