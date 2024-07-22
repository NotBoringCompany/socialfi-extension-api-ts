import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { addOrReplacePOIShop, addPOI, applyTravelBooster, buyItemsInPOIShop, getAvailablePOIDestinations, getCurrentLocation, getCurrentPOI, getSellItemsInPOIPointsBoost, getUserTransactionData, sellItemsInPOIShop, travelToPOI, updateArrival } from '../api/poi';
import { ExtendedProfile } from '../utils/types';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { TRAVEL_TO_POI_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { getMainWallet } from '../api/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { UserWallet } from '../models/user';

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
        let incrementCounterTxHash = '';

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Travel to Poi', {
                distinct_id: validateData?.twitterId,
                '_destination': destination,
            });

            // get the wallet address of the twitter ID
            const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(validateData?.twitterId);

            if (walletStatus !== Status.SUCCESS) {
                // if there is an error somehow, ignore this and just return a success for the API endpoint
                // as this is just an optional tracking feature.
                return res.status(status).json({
                    status,
                    message,
                    data: {
                        incrementCounterTxHash
                    }
                })
            }

            const { address } = walletData.wallet as UserWallet;

            // increment the counter for this mixpanel event on the wonderbits contract
            const incrementCounterTx = await WONDERBITS_CONTRACT.incrementEventCounter(address, TRAVEL_TO_POI_MIXPANEL_EVENT_HASH);
            incrementCounterTxHash = incrementCounterTx.hash;
        }

        return res.status(status).json({
            status,
            message,
            data: {
                incrementCounterTxHash
            }
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

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Apply Travelling Booster', {
                distinct_id: validateData?.twitterId,
                '_booster': booster,
            });
        }

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

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Points Earned (POI Shop)', {
                distinct_id: validateData?.twitterId,
                '_items': items,
                '_leaderboardName': leaderboardName,
                '_earnedPoints': data.leaderboardPoints,
            });
        }

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

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Currency Tracker', {
                distinct_id: validateData?.twitterId,
                '_type': 'Buy Item In POI Shop',
                '_data': data,
            });
        }

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

router.get('/get_sell_items_in_poi_points_boost', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_sell_items_in_poi_points_boost');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await getSellItemsInPOIPointsBoost(validateData?.twitterId);

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