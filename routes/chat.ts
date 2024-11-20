import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { getChatMessages, getUserChatrooms, muteParticipant, unmuteParticipant } from '../api/chat';
import { chatMessageQuery, muteParticipantDTO, sendBlastMessageDTO, unmuteParticipantDTO } from '../validations/chat';
import { authMiddleware } from '../middlewares/auth';
import { broadcastBlastMessage } from '../events/chat';

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

/**
 * @route POST /chat/mute_participant
 * @description Mute a chatroom participant. Only authorized users (e.g., admin) can trigger this action.
 * @param {MuteParticipantDTO} req.body - the data.
 */
router.post('/mute_participant', authMiddleware(3), async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'mute_participant');

        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const validation = muteParticipantDTO.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                status: Status.ERROR,
                message: 'Invalid request data.',
                errors: validation.error.errors,
            });
        }

        const { chatroomId, userId, mutedUntilTimestamp } = validation.data;

        const result = await muteParticipant(userId, chatroomId, mutedUntilTimestamp);

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

/**
 * @route POST /chat/unmute_participant
 * @description Unmute a chatroom participant. Only authorized users (e.g., admin) can trigger this action.
 * @param {UnmuteParticipantDTO} req.body - the data.
 */
router.post('/unmute_participant', authMiddleware(3), async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'unmute_participant');

        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const validation = unmuteParticipantDTO.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                status: Status.ERROR,
                message: 'Invalid request data.',
                errors: validation.error.errors,
            });
        }

        const { chatroomId, userId } = validation.data;

        const result = await unmuteParticipant(userId, chatroomId);

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

/**
 * @route POST /chat/send_blast_message
 * @description Route to manually send a blast message. Only authorized users (e.g., admin) can trigger this action.
 * @param {SendBlastMessageDTO} req.body - the data.
 */
router.post('/send_blast_message', authMiddleware(3), async (req, res) => {
    try {
        // Validate user authorization (assumes you have an auth validation system)
        const auth = await validateRequestAuth(req, res, 'send_blast_message');

        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        // Validate the request body with Zod schema
        const validation = sendBlastMessageDTO.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                status: Status.ERROR,
                message: 'Invalid Payload',
            });
        }

        const { message } = validation.data;

        broadcastBlastMessage(message);

        return res.status(200).json({
            status: Status.SUCCESS,
            message: 'Blast message sent successfully',
        });
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message,
        });
    }
});

export default router;
