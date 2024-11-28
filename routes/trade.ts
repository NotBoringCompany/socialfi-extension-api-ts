import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import {
    AddListingDTO,
    addListingDTO,
    cancelListingDTO,
    claimListingDTO,
    listingsQuery,
    PurchaseListingDTO,
    purchaseListingDTO,
} from '../validations/trade';
import { addListing, cancelListing, claimListing, getUserListings, purchaseListing } from '../api/trade';

const router = express.Router();

/**
 * @route GET /trade/get_listings
 * @description Retrieves all active trade listings. Allows filtering by item, currency, timestamps, and user.
 * @param {listingsQuery} req.query - The query parameters for filtering listings.
 * @returns {ReturnValue} - The status, message, and data with the trade listings.
 */
router.get('/get_listings', async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'get_listings');

        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const validation = listingsQuery.validate(req.query);
        if (validation.status !== Status.SUCCESS) {
            return res.status(validation.status).json(validation);
        }

        const result = await getUserListings(validation.data);

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message,
        });
    }
});

/**
 * @route POST /trade/add_listing
 * @description Adds a new trade listing for the authenticated user.
 * @param {addListingDTO} req.body - The details of the trade listing to be added.
 * @returns {ReturnValue} - The status, message, and details of the added listing.
 */
router.post('/add_listing', async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'add_listing');

        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const validation = addListingDTO.validate(req.body);
        if (validation.status !== Status.SUCCESS) {
            return res.status(validation.status).json(validation);
        }

        const result = await addListing({ ...(validation.data as AddListingDTO), soldBy: auth.data.twitterId });

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message,
        });
    }
});

/**
 * @route POST /trade/purchase_listing
 * @description Processes a purchase request for a trade listing by the authenticated user.
 * @param {purchaseListingDTO} req.body - The details of the listing to be purchased.
 * @returns {ReturnValue} - The status, message, and data for the purchased listing.
 */
router.post('/purchase_listing', async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'purchase_listing');

        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const validation = purchaseListingDTO.validate(req.body);
        if (validation.status !== Status.SUCCESS) {
            return res.status(validation.status).json(validation);
        }

        const result = await purchaseListing({
            ...(validation.data as PurchaseListingDTO),
            userId: auth.data.twitterId,
        });

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message,
        });
    }
});

/**
 * @route POST /trade/claim_listing
 * @description Claims the reward of a specific trade listing for the authenticated user.
 * @param {claimListingDTO} req.body - The details of the listing to be claimed (listingId).
 * @returns {ReturnValue} - The status, message, and claimed listing details.
 */
router.post('/claim_listing', async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'claim_listing');

        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const validation = claimListingDTO.validate(req.body);
        if (validation.status !== Status.SUCCESS) {
            return res.status(validation.status).json(validation);
        }

        const result = await claimListing(validation.data.listingId, auth.data.twitterId);

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message,
        });
    }
});

/**
 * @route POST /trade/cancel_listing
 * @description Cancels an active trade listing by the authenticated user.
 * @param {cancelListingDTO} req.body - The details of the listing to be canceled (listingId).
 * @returns {ReturnValue} - The status, message, and canceled listing details.
 */
router.post('/cancel_listing', async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'cancel_listing');

        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const validation = cancelListingDTO.validate(req.body);
        if (validation.status !== Status.SUCCESS) {
            return res.status(validation.status).json(validation);
        }

        const result = await cancelListing(validation.data.listingId, auth.data.twitterId);

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message,
        });
    }
});

export default router;
