import express from 'express';
import {
    addParticipant,
    getAllParticipant,
    updateParticipant,
    deleteParticipant,
    addBasket,
    updateBasket,
    deleteBasket,
    importParticipants,
    getCollabReward,
    claimCollabReward,
    getCollabStatus,
    collabWinnerChange,
} from '../api/collab';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { authMiddleware } from '../middlewares/auth';
import keyMiddleware from '../middlewares/key';

const router = express.Router();

// Route to add a participant
router.post('/add_participant', authMiddleware(3), async (req, res) => {
    const data = req.body;

    try {
        const { status, message, data: participant } = await addParticipant(data);
        return res.status(status).json({ status, message, data: participant });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to get all participants
router.get('/get_all_participants', authMiddleware(3), async (req, res) => {
    try {
        const { status, message, data: participants } = await getAllParticipant();
        return res.status(status).json({ status, message, data: participants });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to update a participant
router.post('/update_participant', authMiddleware(3), async (req, res) => {
    const { id, data } = req.body;

    try {
        const { status, message, data: participant } = await updateParticipant(id, data);
        return res.status(status).json({ status, message, data: participant });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to delete a participant
router.post('/delete_participant', authMiddleware(3), async (req, res) => {
    const { id } = req.body;

    try {
        const { status, message, data } = await deleteParticipant(id);
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to add a basket
router.post('/add_basket', authMiddleware(3), async (req, res) => {
    const data = req.body;

    try {
        const { status, message, data: basket } = await addBasket(data);
        return res.status(status).json({ status, message, data: basket });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to update a basket
router.post('/update_basket', authMiddleware(3), async (req, res) => {
    const { id, data } = req.body;

    try {
        const { status, message, data: basket } = await updateBasket(id, data);
        return res.status(status).json({ status, message, data: basket });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to delete a basket
router.post('/delete_basket', authMiddleware(3), async (req, res) => {
    const { id } = req.body;

    try {
        const { status, message, data } = await deleteBasket(id);
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to import participants using Google Sheet
router.post('/import_participants', authMiddleware(3), async (req, res) => {
    const { spreadsheetId, range } = req.body;

    try {
        const { status, message } = await importParticipants(spreadsheetId, range);
        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to get collab rewards by Twitter ID
router.get('/get_collab_reward', async (req, res) => {
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'claim_collab_rewards');
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getCollabReward(validateData?.twitterId);
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to claim collab rewards by Twitter ID
router.post('/claim_collab_reward', async (req, res) => {
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'claim_collab_rewards');
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await claimCollabReward(validateData?.twitterId);
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

/**
 * Route to get collab status by link
 */
router.post('/get_collab_status', async (req, res) => {
    const { spreadsheetId, range, link, messages } = req.body;

    try {
        const { status, message, data } = await getCollabStatus(spreadsheetId, range, link, messages);
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

/**
 * Route to append collab winner change request
 */
router.post('/collab_winner_change', keyMiddleware, async (req, res) => {
    const { spreadsheetId, range, projectLink, winnerId, changeId } = req.body;

    try {
        const { status, message, data } = await collabWinnerChange(
            spreadsheetId,
            range,
            projectLink,
            winnerId,
            changeId
        );
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

export default router;
