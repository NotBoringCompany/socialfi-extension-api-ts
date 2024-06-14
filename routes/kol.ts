import express from 'express';
import {
    addKOLCollab,
    getKOLCollabs,
    deleteKOLCollab,
    getKOLCollabById,
    updateKOLCollab,
    addKOLParticipant,
    removeKOLParticipant,
    updateKOLParticipant,
} from '../api/kol';

const router = express.Router();

router.post('/add_kol_collab', async (req, res) => {
    const { tier, maxUsers, rewards, participants, claimable, approved } = req.body;

    try {
        const { status, message, data } = await addKOLCollab({
            tier,
            maxUsers,
            rewards,
            participants,
        });

        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

router.get('/get_kol_collabs', async (req, res) => {
    try {
        const { status, message, data } = await getKOLCollabs();

        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

router.get('/get_kol_collab/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { status, message, data } = await getKOLCollabById(id);

        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

router.post('/delete_kol_collab', async (req, res) => {
    const { id } = req.body;

    try {
        const { status, message, data } = await deleteKOLCollab(id);

        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

router.post('/update_kol_collab', async (req, res) => {
    const { id, ...data } = req.body;

    try {
        const { status, message, data: updatedData } = await updateKOLCollab(id, data);

        return res.status(status).json({ status, message, data: updatedData });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

router.post('/add_kol_participant', async (req, res) => {
    const { collabId, participant } = req.body;

    try {
        const { status, message, data } = await addKOLParticipant(collabId, participant);

        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

router.post('/remove_kol_participant', async (req, res) => {
    const { collabId, participantId } = req.body;

    try {
        const { status, message, data } = await removeKOLParticipant(collabId, participantId);

        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

router.post('/update_kol_participant', async (req, res) => {
    const { collabId, participantId, updatedParticipant } = req.body;

    try {
        const { status, message, data } = await updateKOLParticipant(collabId, participantId, updatedParticipant);

        return res.status(status).json({ status, message, data });
    } catch (err: any) {
        return res.status(500).json({ status: 500, message: err.message });
    }
});

export default router;
