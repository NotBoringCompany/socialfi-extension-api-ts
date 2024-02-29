import express from 'express';
import { checkCurrentTax, claimResources, claimXCookies, evolveIsland, getIslands, placeBit } from '../api/island';

const router = express.Router();

// temporarily without authentication for testing purposes
router.post('/place_bit', async (req, res) => {
    const { twitterId, islandId, bitId } = req.body;

    try {
        const { status, message, data } = await placeBit(twitterId, islandId, bitId);

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

router.get('/check_current_tax/:twitterId/:islandId', async (req, res) => {
    const { twitterId, islandId } = req.params;

    try {
        const { status, message, data } = await checkCurrentTax(twitterId, parseInt(islandId));

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
router.post('/evolve_island', async (req, res) => {
    const { twitterId, islandId } = req.body;

    try {
        const { status, message, data } = await evolveIsland(twitterId, islandId);

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
router.post('/claim_xcookies', async (req, res) => {
    const { twitterId, islandId } = req.body;

    try {
        const { status, message, data } = await claimXCookies(twitterId, islandId);

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
router.post('/claim_resources', async (req, res) => {
    const { twitterId, islandId } = req.body;

    try {
        const { status, message, data } = await claimResources(twitterId, islandId);

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

router.get('/get_islands', async (req, res) => {
    const islandIdsParam = req.query.islandIds as string;

    // convert string to array
    const islandIds = islandIdsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

    try {
        const { status, message, data } = await getIslands(islandIds);

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