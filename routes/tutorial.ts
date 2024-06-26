import express from 'express';
import { completeTutorial, getTutorials } from '../api/tutorial';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';

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