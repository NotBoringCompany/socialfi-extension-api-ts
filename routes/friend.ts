import express from 'express';
import {
    getFriends,
    getFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    deleteFriend,
} from '../api/friend';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';

const router = express.Router();

router.get('/get_friends', async (req, res) => {
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'get_friends');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({ status: validateStatus, message: validateMessage });
        }

        const { status, message, data } = await getFriends(validateData.twitterId);
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(Status.ERROR).json({ status: Status.ERROR, message: err.message });
    }
});

router.get('/get_friend_requests', async (req, res) => {
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'get_friend_requests');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({ status: validateStatus, message: validateMessage });
        }

        const { status, message, data } = await getFriendRequests(validateData.twitterId);
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(Status.ERROR).json({ status: Status.ERROR, message: err.message });
    }
});

router.post('/send_friend_request', async (req, res) => {
    const { friendId } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'send_friend_request');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({ status: validateStatus, message: validateMessage });
        }

        const { status, message } = await sendFriendRequest(validateData.twitterId, friendId);
        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(Status.ERROR).json({ status: Status.ERROR, message: err.message });
    }
});

router.post('/accept_friend_request', async (req, res) => {
    const { friendId } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'accept_friend_request');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({ status: validateStatus, message: validateMessage });
        }

        const { status, message } = await acceptFriendRequest(validateData.twitterId, friendId);
        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(Status.ERROR).json({ status: Status.ERROR, message: err.message });
    }
});

router.post('/reject_friend_request', async (req, res) => {
    const { friendId } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'reject_friend_request');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({ status: validateStatus, message: validateMessage });
        }

        const { status, message } = await rejectFriendRequest(validateData.twitterId, friendId);
        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(Status.ERROR).json({ status: Status.ERROR, message: err.message });
    }
});

router.post('/cancel_friend_request', async (req, res) => {
    const { friendId } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'cancel_friend_request');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({ status: validateStatus, message: validateMessage });
        }

        const { status, message } = await cancelFriendRequest(validateData.twitterId, friendId);
        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(Status.ERROR).json({ status: Status.ERROR, message: err.message });
    }
});

router.delete('/delete_friend', async (req, res) => {
    const { friendId } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'delete_friend');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({ status: validateStatus, message: validateMessage });
        }

        const { status, message } = await deleteFriend(validateData.twitterId, friendId);
        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(Status.ERROR).json({ status: Status.ERROR, message: err.message });
    }
});

export default router;
