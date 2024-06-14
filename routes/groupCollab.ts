import express from 'express';
import { addGroupCollab, getGroupCollabs, deleteGroupCollab, addGroup, addGroupParticipant, removeGroup, removeGroupParticipant } from '../api/groupCollab';
import keyMiddleware from '../middlewares/key';

const router = express.Router();

// secure all routes
router.use(keyMiddleware);

// Route to add a Group Collab
router.post('/add_group_collab', async (req, res) => {
    const data = req.body;

    try {
        const { status, message, data: collab } = await addGroupCollab(data);

        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to get all Group Collabs
router.get('/get_group_collabs', async (req, res) => {
    try {
        const { status, message, data: collabs } = await getGroupCollabs();

        return res.status(status).json({ status, message, data: collabs });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to delete a Group Collab
router.delete('/delete_group_collab/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { status, message } = await deleteGroupCollab(id);

        return res.status(status).json({ status, message });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to add a Group to a Group Collab
router.post('/add_group', async (req, res) => {
    const { collabId, group } = req.body;

    try {
        const { status, message, data: collab } = await addGroup(collabId, group);

        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to add a Participant to a Group in a Group Collab
router.post('/add_group_participant', async (req, res) => {
    const { collabId, groupId, participant } = req.body;

    try {
        const { status, message, data: collab } = await addGroupParticipant(collabId, groupId, participant);

        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to remove a Group from a Group Collab
router.delete('/remove_group', async (req, res) => {
    const { collabId, groupId } = req.body;

    try {
        const { status, message, data: collab } = await removeGroup(collabId, groupId);

        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

// Route to remove a Participant from a Group in a Group Collab
router.delete('/remove_group_participant', async (req, res) => {
    const { collabId, groupId, participantId } = req.body;

    try {
        const { status, message, data: collab } = await removeGroupParticipant(collabId, groupId, participantId);

        return res.status(status).json({ status, message, data: collab });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

export default router;
