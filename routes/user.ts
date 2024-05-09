import express from 'express';
import { checkInviteCodeLinked, claimBeginnerRewards, claimDailyRewards, generateSignatureMessage, getBeginnerRewardsData, getInGameData, getInventory, getUserData, getWalletDetails, linkInviteCode, linkSecondaryWallet, removeResources } from '../api/user';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { ExtendedProfile } from '../utils/types';
import { mixpanel } from '../utils/mixpanel';

const router = express.Router();

router.get('/get_user_data', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_user_data');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await getUserData(validateData?.twitterId);

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

router.get('/get_inventory/:twitterId', async (req, res) => {
    const { twitterId } = req.params;

    try {
        const { status, message, data } = await getInventory(twitterId);

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

router.post('/remove_resources', async (req, res) => {
    const { resourcesToRemove } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'remove_resources');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await removeResources(validateData?.twitterId, resourcesToRemove);

        mixpanel.track('Remove Resources', {
            distinct_id: validateData?.twitterId,
            '_removedResource': resourcesToRemove,
        });

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

router.get('/get_wallet_details', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_wallet_details');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await getWalletDetails(validateData?.twitterId);

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

router.get('/get_in_game_data', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_in_game_data');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await getInGameData(validateData?.twitterId);

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

router.post('/claim_daily_rewards', async (req, res) => {
    const { leaderboardName } = req.body;
    
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_daily_rewards');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimDailyRewards(validateData?.twitterId, leaderboardName);

        mixpanel.track('Claim Daily Rewards', {
            distinct_id: validateData?.twitterId,
            '_rewards': data?.dailyLoginRewards,
        });

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

router.post('/link_invite_code', async (req, res) => {
    const { code } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'link_starter_or_referral_code');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await linkInviteCode(validateData?.twitterId, code);

        mixpanel.track('Link Invite Code', {
            distinct_id: validateData?.twitterId,
            '_code': code,
            '_data': data
        });

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

router.get('/check_invite_code_linked/:twitterId', async (req, res) => {
    const { twitterId } = req.params;

    try {
        const { status, message, data } = await checkInviteCodeLinked(twitterId);

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

router.post('/claim_beginner_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_beginner_rewards');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimBeginnerRewards(validateData?.twitterId);

        mixpanel.track('Claim Beginner Rewards', {
            distinct_id: validateData?.twitterId,
            '_rewards': data?.rewards,
        });

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

router.post('/generate_signature_message', async (req, res) => {
    const { walletAddress } = req.body;
    
    try {
        const message = generateSignatureMessage(walletAddress);

        return res.status(200).json({
            status: 200,
            message: 'Signature message generated successfully.',
            data: {
                signatureMessage: message
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
})

router.post('/link_secondary_wallet', async (req, res) => {
    const { walletAddress, signatureMessage, signature } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'link_secondary_wallet');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await linkSecondaryWallet(
            validateData?.twitterId,
            walletAddress,
            signatureMessage,
            signature
        );

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
})

export default router;