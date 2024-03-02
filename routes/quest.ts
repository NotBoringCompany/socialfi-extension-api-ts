import express from 'express';
import { addQuest, completeQuest, deleteQuest, getQuests, getUserCompletedQuests } from '../api/quest';
import { validateJWT } from '../utils/jwt';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';

const router = express.Router();

router.post('/add_quest', async (req, res) => {
    const {
        name,
        description,
        type,
        imageUrl,
        start,
        end,
        rewards,
        requirements,
        adminKey
    } = req.body;

    try {
        const { status, message, data } = await addQuest(
            name,
            description,
            type,
            imageUrl,
            start,
            end,
            rewards,
            requirements,
            adminKey
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
        })
    }
});

router.post('/complete_quest', async (req, res) => {
    const { questId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'complete_quest');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await completeQuest(validateData?.twitterId, questId);

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

router.get('/get_quests', async (_, res) => {
    try {
        const { status, message, data } = await getQuests();

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

router.post('/delete_quest', async (req, res) => {
    const { questId, adminKey } = req.body;

    try {
        const { status, message, data } = await deleteQuest(questId, adminKey);

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

// temporarily without authentication for testing purposes
router.get('/get_user_completed_quests/:twitterId', async (req, res) => {
    const { twitterId } = req.params;

    try {
        const { status, message, data } = await getUserCompletedQuests(twitterId);

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