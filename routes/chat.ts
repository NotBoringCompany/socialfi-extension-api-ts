import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { getChatMessages, getUserChatrooms } from '../api/chat';
import { chatMessageQuery } from '../validations/chat';

const router = express.Router();

router.get('/get_chatrooms', async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'get_chatrooms');

        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const result = await getUserChatrooms(auth.data?.twitterId);

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.get('/get_messages', async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'get_messages');

        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const query = chatMessageQuery.validate(req.query);
        if (query.status !== Status.SUCCESS) {
            return res.status(query.status).json(query);
        }

        const result = await getChatMessages({ ...query.data, user: auth.data.twitterId });

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

export default router;
