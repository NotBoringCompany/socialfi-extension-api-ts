import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { addOrReplacePOIShop, addPOI, applyTravelBooster, buyItemsInPOIShop, getAvailablePOIDestinations, getCurrentLocation, getCurrentPOI, getUserTransactionData, sellItemsInPOIShop, travelToPOI, updateArrival } from '../api/poi';
import { ExtendedProfile } from '../utils/types';
import { mixpanel } from '../utils/mixpanel';

const router = express.Router();

router.post('/add_poi', async (req, res) => {
    const { name, distanceTo, shop, adminKey } = req.body;

    try {
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

        mixpanel.track('Travel to Poi', {
            distinct_id: validateData?.twitterId,
            '_destination': destination,
        });

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

router.post('/apply_travel_booster', async (req, res) => {
    const { booster } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'apply_travel_booster');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message } = await applyTravelBooster(validateData?.twitterId, booster);

        mixpanel.track('Apply Travelling Booster', {
            distinct_id: validateData?.twitterId,
            '_booster': booster,
        });

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

        mixpanel.track('POI Shop: Sell Item', {
            distinct_id: validateData?.twitterId,
            '_items': items,
            '_leaderboardName': leaderboardName,
        });

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

        mixpanel.track('POI Shop: Sell Item', {
            distinct_id: validateData?.twitterId,
            '_items': items,
            '_paymentChoice': paymentChoice,
        });

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

router.get('/get_user_transaction_data', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_user_transaction_data');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await getUserTransactionData(validateData?.twitterId);

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