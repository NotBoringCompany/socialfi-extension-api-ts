import express from 'express';
import { addQuest, completeQuest, deleteQuest, getQuests, getUserCompletedQuests } from '../api/quest';
import { validateJWT } from '../utils/jwt';
import { Status } from '../utils/retVal';

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
    // allow from twitter.com
    res.header('Access-Control-Allow-Origin', 'https://twitter.com');
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { questId } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // bearer JWT token

    if (!token) {
        return res.status(401).json({
            status: Status.UNAUTHORIZED,
            message: '(complete_quest) No token provided.',
        });
    }

    const { status: validateStatus, message: validateMessage, data: validateData } = validateJWT(token);
    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            validateStatus,
            validateMessage
        });
    }

    const { twitterId } = validateData;

    if (!twitterId) {
        return res.status(401).json({
            status: Status.UNAUTHORIZED,
            message: '(complete_quest) You denied the app or your session has expired.'
        });
    }

    try {
        const { status, message, data } = await completeQuest(twitterId, questId);

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