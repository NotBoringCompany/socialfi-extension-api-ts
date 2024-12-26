import express from 'express';
import { checkInviteCodeLinked, claimBeginnerRewards, claimDailyRewards, consumeEnergyPotion, generateSignatureMessage, generateUnlinkSignatureMessage, getBeginnerRewardsData, getInGameData, getInventory, getUserData, getWalletDetails, linkInviteCode, linkSecondaryWallet, removeResources, unlinkSecondaryWallet } from '../api/user';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { ExtendedProfile } from '../utils/types';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';


const router = express.Router();

router.get('/get_user_data/:twitterId/:adminKey', async (req, res) => {
    const { twitterId, adminKey } = req.params;
    try {
        let actualTwitterId: string = '';

        // if admin key is empty or not the same as ADMIN_KEY, use `validateRequestAuth` to check if the request is valid via JWT token
        if (adminKey !== process.env.ADMIN_KEY) {
            const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_user_data');

            if (validateStatus !== Status.SUCCESS) {
                return res.status(validateStatus).json({
                    status: validateStatus,
                    message: validateMessage
                })
            }
            actualTwitterId = validateData?.twitterId;
        } else {
            actualTwitterId = twitterId;
        }
        const { status, message, data } = await getUserData(actualTwitterId);

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
            });
        }

        const { status, message, data } = await removeResources(validateData?.twitterId, resourcesToRemove);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Remove Resources', {
                distinct_id: validateData?.twitterId,
                '_removedResource': resourcesToRemove,
            });

            
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
        });
    }
});

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
            });
        }

        const { status, message, data } = await claimDailyRewards(validateData?.twitterId, leaderboardName);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Claim Daily Rewards', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });

            
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
        });
    }
});

router.post('/link_invite_code', async (req, res) => {
    const { code } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'link_starter_or_referral_code');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            });
        }

        const { status, message, data } = await linkInviteCode(validateData?.twitterId, code);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Link Invite Code', {
                distinct_id: validateData?.twitterId,
                '_code': code,
                '_data': data
            });

            
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
        });
    }
});

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
            });
        }

        const { status, message, data } = await claimBeginnerRewards(validateData?.twitterId);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Claim Beginner Rewards', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });

            
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
        });
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
});

router.post('/generate_unlink_signature_message', async (req, res) => {
    const { walletAddress } = req.body;
    try {

        const message = generateUnlinkSignatureMessage(walletAddress);

        return res.status(200).json({
            status: 200,
            message: 'Signature message for unlinking wallet generated successfully.',
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
    const { walletAddress, signatureMessage, signature, provider } = req.body;
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
            provider,
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

router.post('/unlink_secondary_wallet', async (req, res) => {
    const { walletAddress, signatureMessage, signature } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'unlink_secondary_wallet');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await unlinkSecondaryWallet(
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

router.post('/consume_energy_potion', async (req, res) => {
    const { tappingProgress } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'consume_energy_potion');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await consumeEnergyPotion(validateData?.twitterId, tappingProgress);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Consume Energy Potion', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });

            
        }
        
        return res.status(status).json({
            status,
            message,
            data,
        })
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
})

export default router;