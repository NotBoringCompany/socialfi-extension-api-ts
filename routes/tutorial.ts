import express from 'express';
import { completeTutorial, getTutorials, skipTutorial } from '../api/tutorial';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';

import { allowMixpanel, mixpanel } from '../utils/mixpanel';

const router = express.Router();

router.get('/get_tutorials', async (req, res) => {
    try {
        const { status, message, data } = await getTutorials();

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

router.post('/complete_tutorial', async (req, res) => {
    const { tutorialId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'complete_tutorial');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await completeTutorial(validateData?.twitterId, tutorialId);

        if (status === Status.SUCCESS && tutorialId === 11 && allowMixpanel) {
            mixpanel.track('Tutorial Completed', {
                distinct_id: validateData?.twitterId,
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
        })
    }
})

// router.post('/skip_tutorial', async (req, res) => {
//     try {
//         const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'skip_tutorial');

//         if (validateStatus !== Status.SUCCESS) {
//             return res.status(validateStatus).json({
//                 status: validateStatus,
//                 message: validateMessage
//             })
//         }

//         const { status, message, data } = await skipTutorial(validateData?.twitterId);

//         if (status === Status.SUCCESS && allowMixpanel) {
//             mixpanel.track('Tutorial Skipped', {
//                 distinct_id: validateData?.twitterId,
//             });
//         }

//         return res.status(status).json({
//             status,
//             message,
//             data
//         });
//     } catch (err: any) {
//         return res.status(500).json({
//             status: 500,
//             message: err.message
//         })
//     }
// })

export default router;