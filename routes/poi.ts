import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { addOrReplacePOIShop, addPOI, buyItemsInPOIShop, getAvailablePOIDestinations, getCurrentLocation, getCurrentPOI, sellItemsInPOIShop, travelToPOI, updateArrival } from '../api/poi';

const router = express.Router();

router.post('/add_poi', async (req, res) => {
    const { name, distanceTo, shop, adminKey } = req.body;

    try {
        const { status: validateStatus, message: validateMessage } = await validateRequestAuth(req, res, 'add_poi');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message } = await addPOI(name, distanceTo, shop, adminKey);

        return res.status(status).json({
            status,
            message
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

router.post('/travel_to_poi', async (req, res) => {
    const { destination } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'travel_to_poi');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message } = await travelToPOI(validateData?.twitterId, destination);

        return res.status(status).json({
            status,
            message
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

router.get('/get_available_poi_destinations', async (req, res) => {
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'get_available_poi_destinations');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getAvailablePOIDestinations(validateData?.twitterId);

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

router.post('/update_arrival', async (req, res) => {
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'update_arrival');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message } = await updateArrival(validateData?.twitterId);

        return res.status(status).json({
            status,
            message
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.post('/add_or_replace_poi_shop', async (req, res) => {
    const { poiName, shop, adminKey } = req.body;

    try {
        const { status: validateStatus, message: validateMessage } = await validateRequestAuth(req, res, 'add_or_replace_poi_shop');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message } = await addOrReplacePOIShop(poiName, shop, adminKey);

        return res.status(status).json({
            status,
            message
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

router.get('/get_current_poi', async (req, res) => {
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'get_current_poi');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getCurrentPOI(validateData?.twitterId);

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

router.post('/sell_items_in_poi_shop', async (req, res) => {
    const { items, leaderboardName } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'sell_items_in_poi_shop');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await sellItemsInPOIShop(validateData?.twitterId, items, leaderboardName);

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

router.post('/buy_items_in_poi_shop', async (req, res) => {
    const { items, paymentChoice } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'buy_items_in_poi_shop');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await buyItemsInPOIShop(validateData?.twitterId, items, paymentChoice);

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