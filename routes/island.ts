import express from 'express';
import { checkCurrentTax, claimResources, claimXCookies, evolveIsland, getIslands, placeBit } from '../api/island';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';

const router = express.Router();

router.post('/place_bit', async (req, res) => {
    const { islandId, bitId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'place_bit');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await placeBit(validateData?.twitterId, islandId, bitId);

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

router.post('/evolve_island', async (req, res) => {
    const { islandId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'evolve_island');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await evolveIsland(validateData?.twitterId, islandId);

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

router.post('/claim_xcookies', async (req, res) => {
    const { islandId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_xcookies');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await claimXCookies(validateData?.twitterId, islandId);

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

router.post('/claim_resources', async (req, res) => {
    const { islandId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_resources');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await claimResources(validateData?.twitterId, islandId);

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