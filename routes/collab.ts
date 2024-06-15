import express from 'express';
import {
    addCollab,
    getCollabs,
    deleteCollab,
    getCollabById,
    updateCollab,
    addParticipant,
    removeParticipant,
    updateParticipant,
    addGroup,
    removeGroup,
    addGroupParticipant,
    removeGroupParticipant,
    importParticipants,
    importGroupParticipants,
    getCollabRewards,
    claimCollabRewards,
} from '../api/collab';
import keyMiddleware from '../middlewares/key';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';

const router = express.Router();

// Route to add a collab
router.post('/add_collab', keyMiddleware, async (req, res) => {
    const data = req.body;

    try {
        const { status, message, data: collab } = await addCollab(data);
        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to get all collabs
router.get('/get_collabs/:type', keyMiddleware, async (req, res) => {
    const { type } = req.params;

    try {
        const { status, message, data: collabs } = await getCollabs(type as 'kol' | 'group');
        return res.status(status).json({ status, message, data: collabs });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to delete a collab
router.post('/delete_collab', keyMiddleware, async (req, res) => {
    const { id } = req.body;

    try {
        const { status, message, data } = await deleteCollab(id);
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to get a collab by ID
router.get('/get_collab/:id', keyMiddleware, async (req, res) => {
    const { id } = req.params;

    try {
        const { status, message, data: collab } = await getCollabById(id);
        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to update a collab
router.post('/update_collab', keyMiddleware, async (req, res) => {
    const { id } = req.body;
    const data = req.body;

    try {
        const { status, message, data: collab } = await updateCollab(id, data);
        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to add a participant to a collab
router.post('/add_participant', keyMiddleware, async (req, res) => {
    const { collabId, participant } = req.body;

    try {
        const { status, message, data: collab } = await addParticipant(collabId, participant);
        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to remove a participant from a collab
router.post('/remove_participant', keyMiddleware, async (req, res) => {
    const { collabId, participantId } = req.body;

    try {
        const { status, message, data: collab } = await removeParticipant(collabId, participantId);
        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to update a participant in a collab
router.post('/update_participant', keyMiddleware, async (req, res) => {
    const { collabId, participantId, updatedParticipant } = req.body;

    try {
        const { status, message, data: collab } = await updateParticipant(collabId, participantId, updatedParticipant);
        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to add a group to a collab
router.post('/add_group', keyMiddleware, async (req, res) => {
    const { collabId, group } = req.body;

    try {
        const { status, message, data: collab } = await addGroup(collabId, group);
        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to remove a group from a collab
router.post('/remove_group', keyMiddleware, async (req, res) => {
    const { collabId, groupId } = req.body;

    try {
        const { status, message, data: collab } = await removeGroup(collabId, groupId);
        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to add a participant to a group in a collab
router.post('/add_group_participant', keyMiddleware, async (req, res) => {
    const { collabId, groupId, participant } = req.body;

    try {
        const { status, message, data: collab } = await addGroupParticipant(collabId, groupId, participant);
        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to remove a participant from a group in a collab
router.post('/remove_group_participant', keyMiddleware, async (req, res) => {
    const { collabId, groupId, participantId } = req.body;

    try {
        const { status, message, data: collab } = await removeGroupParticipant(collabId, groupId, participantId);
        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to import participants using Google Sheet
router.post('/import_participants', keyMiddleware, async (req, res) => {
    const { spreadsheetId, range } = req.body;

    try {
        const { status, message } = await importParticipants(spreadsheetId, range);
        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to import group participants using Google Sheet
router.post('/import_group_participants', keyMiddleware, async (req, res) => {
    const { spreadsheetId, range } = req.body;

    try {
        const { status, message } = await importGroupParticipants(spreadsheetId, range);
        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to get collab rewards by twitter username
router.get('/get_collab_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_collab_rewards');
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getCollabRewards(validateData?.twitterId);
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to claim collab rewards by twitter username
router.post('/claim_collab_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_collab_rewards');
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await claimCollabRewards(validateData?.twitterId);
        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

export default router;
