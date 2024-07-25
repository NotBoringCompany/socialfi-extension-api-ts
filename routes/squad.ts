import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { acceptPendingSquadMember, checkSquadCreationMethodAndCost, createSquad, declinePendingSquadMember, delegateLeadership, getLatestSquadWeeklyRanking, getSquadData, getSquadMemberData, kickMember, leaveSquad, renameSquad, requestToJoinSquad, squadKOSData, upgradeSquadLimit } from '../api/squad';
import { mixpanel } from '../utils/mixpanel';
import { authMiddleware } from '../middlewares/auth';
import { CREATE_SQUAD_MIXPANEL_EVENT_HASH, GET_CURRENT_USER_SQUAD_MIXPANEL_EVENT_HASH, JOIN_SQUAD_MIXPANEL_EVENT_HASH, KICK_SQUAD_MEMBER_MIXPANEL_EVENT_HASH, LEAVE_SQUAD_MIXPANEL_EVENT_HASH, RENAME_SQUAD_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { UserWallet } from '../models/user';
import { getMainWallet } from '../api/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { checkWonderbitsAccountRegistrationRequired } from '../api/web3';

const router = express.Router();

router.post('/request_to_join_squad', async (req, res) => {
    const { squadId, squadName } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'request_to_join_squad');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await requestToJoinSquad(validateData?.twitterId, squadId, squadName);

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

router.post('/accept_pending_squad_member', async (req, res) => {
    const { memberTwitterId, memberUserId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'accept_pending_squad_member');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await acceptPendingSquadMember(validateData?.twitterId, memberTwitterId, memberUserId);

        if (status === Status.SUCCESS) {
            mixpanel.track('Squad Member', {
                distinct_id: validateData?.twitterId,
                '_type': 'Join',
                '_data': data,
            });

            // get the wallet address of the twitter ID
            // const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(validateData?.twitterId);

            // if (walletStatus !== Status.SUCCESS) {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     return res.status(status).json({
            //         status,
            //         message,
            //         data
            //     })
            // }

            // const { address } = walletData.wallet as UserWallet;

            // // check if the user has an account registered in the contract.
            // const { status: wonderbitsAccStatus } = await checkWonderbitsAccountRegistrationRequired(address);

            // if (wonderbitsAccStatus !== Status.SUCCESS) {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     return res.status(status).json({
            //         status,
            //         message,
            //         data
            //     })
            // }

            // // increment the counter for this mixpanel event on the wonderbits contract
            // await WONDERBITS_CONTRACT.incrementEventCounter(address, JOIN_SQUAD_MIXPANEL_EVENT_HASH).catch((err: any) => {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     // return res.status(status).json({
            //     //     status,
            //     //     message,
            //     //     data
            //     // })
            //     console.error('Error incrementing event counter:', err);
            // })
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

router.post('/rename_squad', async (req, res) => {
    const { newSquadName } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'rename_squad');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await renameSquad(validateData?.twitterId, newSquadName);

        if (status === Status.SUCCESS) {
            mixpanel.track('Currency Tracker', {
                distinct_id: validateData?.twitterId,
                '_type': 'Rename Squad',
                '_data': data,
            });

            // get the wallet address of the twitter ID
            // const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(validateData?.twitterId);

            // if (walletStatus !== Status.SUCCESS) {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     return res.status(status).json({
            //         status,
            //         message,
            //         data
            //     })
            // }

            // const { address } = walletData.wallet as UserWallet;

            // // check if the user has an account registered in the contract.
            // const { status: wonderbitsAccStatus } = await checkWonderbitsAccountRegistrationRequired(address);

            // if (wonderbitsAccStatus !== Status.SUCCESS) {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     return res.status(status).json({
            //         status,
            //         message,
            //         data
            //     })
            // }

            // // increment the counter for this mixpanel event on the wonderbits contract
            // await WONDERBITS_CONTRACT.incrementEventCounter(address, RENAME_SQUAD_MIXPANEL_EVENT_HASH).catch((err: any) => {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     // return res.status(status).json({
            //     //     status,
            //     //     message,
            //     //     data
            //     // })
            //     console.error('Error incrementing event counter:', err);
            // })
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

router.post('/create_squad', async (req, res) => {
    const { squadName } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'create_squad');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await createSquad(validateData?.twitterId, squadName);

        if (status === Status.SUCCESS) {
            mixpanel.track('Currency Tracker', {
                distinct_id: validateData?.twitterId,
                '_type': 'Create Squad',
                '_data': data,
            });

            // get the wallet address of the twitter ID
            // const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(validateData?.twitterId);

            // if (walletStatus !== Status.SUCCESS) {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     return res.status(status).json({
            //         status,
            //         message,
            //         data
            //     })
            // }

            // const { address } = walletData.wallet as UserWallet;

            // // check if the user has an account registered in the contract.
            // const { status: wonderbitsAccStatus } = await checkWonderbitsAccountRegistrationRequired(address);

            // if (wonderbitsAccStatus !== Status.SUCCESS) {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     return res.status(status).json({
            //         status,
            //         message,
            //         data
            //     })
            // }

            // // increment the counter for this mixpanel event on the wonderbits contract
            // await WONDERBITS_CONTRACT.incrementEventCounter(address, CREATE_SQUAD_MIXPANEL_EVENT_HASH).catch((err: any) => {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     // return res.status(status).json({
            //     //     status,
            //     //     message,
            //     //     data
            //     // })
            //     console.error('Error incrementing event counter:', err);
            // })
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

router.post('/leave_squad', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'leave_squad');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await leaveSquad(validateData?.twitterId);

        if (status === Status.SUCCESS) {
            mixpanel.track('Squad Member', {
                distinct_id: validateData?.twitterId,
                '_type': 'Leave',
                '_currentMembers': data.currentMembers,
            });

            // get the wallet address of the twitter ID
            // const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(validateData?.twitterId);

            // if (walletStatus !== Status.SUCCESS) {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     return res.status(status).json({
            //         status,
            //         message,
            //         data
            //     })
            // }

            // const { address } = walletData.wallet as UserWallet;

            // // check if the user has an account registered in the contract.
            // const { status: wonderbitsAccStatus } = await checkWonderbitsAccountRegistrationRequired(address);

            // if (wonderbitsAccStatus !== Status.SUCCESS) {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     return res.status(status).json({
            //         status,
            //         message,
            //         data
            //     })
            // }

            // // increment the counter for this mixpanel event on the wonderbits contract
            // await WONDERBITS_CONTRACT.incrementEventCounter(address, LEAVE_SQUAD_MIXPANEL_EVENT_HASH).catch((err: any) => {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     // return res.status(status).json({
            //     //     status,
            //     //     message,
            //     //     data
            //     // })
            //     console.error('Error incrementing event counter:', err);
            // })
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

router.post('/upgrade_squad_limit', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'upgrade_squad_limit');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await upgradeSquadLimit(validateData?.twitterId);

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

router.post('/delegate_leadership', async (req, res) => {
    const { newLeaderTwitterId, newLeaderUserId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'delegate_leadership');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await delegateLeadership(validateData?.twitterId, newLeaderTwitterId, newLeaderUserId);

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

router.post('/kick_member', async (req, res) => {
    const { memberTwitterId, memberUserId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'kick_member');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await kickMember(validateData?.twitterId, memberTwitterId, memberUserId);

        if (status === Status.SUCCESS) {
            mixpanel.track('Squad Member', {
                distinct_id: validateData?.twitterId,
                '_type': 'Kick',
                '_data': data
            });

            // get the wallet address of the twitter ID
            // const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(validateData?.twitterId);

            // if (walletStatus !== Status.SUCCESS) {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     return res.status(status).json({
            //         status,
            //         message,
            //         data
            //     })
            // }

            // const { address } = walletData.wallet as UserWallet;

            // // check if the user has an account registered in the contract.
            // const { status: wonderbitsAccStatus } = await checkWonderbitsAccountRegistrationRequired(address);

            // if (wonderbitsAccStatus !== Status.SUCCESS) {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     return res.status(status).json({
            //         status,
            //         message,
            //         data
            //     })
            // }

            // // increment the counter for this mixpanel event on the wonderbits contract
            // await WONDERBITS_CONTRACT.incrementEventCounter(address, KICK_SQUAD_MEMBER_MIXPANEL_EVENT_HASH).catch((err: any) => {
            //     // if there is an error somehow, ignore this and just return a success for the API endpoint
            //     // as this is just an optional tracking feature.
            //     // return res.status(status).json({
            //     //     status,
            //     //     message,
            //     //     data
            //     // })
            //     console.error('Error incrementing event counter:', err);
            // })
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

router.get('/get_squad_data/:twitterId/:squadId', async (req, res) => {
    const { twitterId, squadId } = req.params;
    try {
        const { status, message, data } = await getSquadData(squadId);

        mixpanel.track('Current User Squad', {
            distinct_id: twitterId,
            '_data': data,
            '_inSquad': status === Status.SUCCESS,
        });

        // get the wallet address of the twitter ID
        // const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(twitterId);

        // if (walletStatus !== Status.SUCCESS) {
        //     // if there is an error somehow, ignore this and just return a success for the API endpoint
        //     // as this is just an optional tracking feature.
        //     return res.status(status).json({
        //         status,
        //         message,
        //         data
        //     })
        // }

        // const { address } = walletData.wallet as UserWallet;

        // // check if the user has an account registered in the contract.
        // const { status: wonderbitsAccStatus } = await checkWonderbitsAccountRegistrationRequired(address);

        // if (wonderbitsAccStatus !== Status.SUCCESS) {
        //     // if there is an error somehow, ignore this and just return a success for the API endpoint
        //     // as this is just an optional tracking feature.
        //     return res.status(status).json({
        //         status,
        //         message,
        //         data
        //     })
        // }

        // // increment the counter for this mixpanel event on the wonderbits contract
        // await WONDERBITS_CONTRACT.incrementEventCounter(address, GET_CURRENT_USER_SQUAD_MIXPANEL_EVENT_HASH).catch((err: any) => {
        //     // if there is an error somehow, ignore this and just return a success for the API endpoint
        //     // as this is just an optional tracking feature.
        //     // return res.status(status).json({
        //     //     status,
        //     //     message,
        //     //     data
        //     // })
        //     console.error('Error incrementing event counter:', err);
        // })

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

router.post('/decline_pending_squad_member', async (req, res) => {
    const { memberTwitterId, memberUserId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'decline_pending_squad_member');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await declinePendingSquadMember(validateData?.twitterId, memberTwitterId, memberUserId);

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

router.get('/get_create_squad_method_and_cost', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_create_squad_cost');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }
        
        const { status, message, data } = await checkSquadCreationMethodAndCost(validateData?.twitterId);

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

router.get('/get_squad_kos_data', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_squad_kos_data');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }
        
        const { status, message, data } = await squadKOSData(validateData?.twitterId);

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

router.get('/get_latest_squad_weekly_ranking/:squadId', async (req, res) => {
    const { squadId } = req.params;
    try {
        const { status, message, data } = await getLatestSquadWeeklyRanking(squadId);

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

router.get('/get_squad_member_data/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const { status, message, data } = await getSquadMemberData(userId);

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