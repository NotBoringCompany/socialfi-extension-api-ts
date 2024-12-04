import { ClientSession } from 'mongoose';
import { Food, FoodType } from '../models/food';
import { Item } from '../models/item';
import { TradeStatus } from '../models/trade';
import { ExtendedXCookieData, UserInventory, XCookieSource } from '../models/user';
import { TEST_CONNECTION, TradeListingModel, UserModel } from '../utils/constants/db';
import { MAXIMUM_ACTIVE_TRADE_LISTING } from '../utils/constants/trade';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { AddListingDTO, ListingsQuery, PurchaseListingDTO } from '../validations/trade';

/**
 * Retrieves all active trade listings.
 */
export const getListings = async (query: ListingsQuery): Promise<ReturnValue> => {
    try {
        const listingsQuery = TradeListingModel.find({ status: TradeStatus.ACTIVE });

        if (query.item) {
            listingsQuery.where('item').equals(query.item);
        }

        if (query.currency) {
            listingsQuery.where('currency').equals(query.currency);
        }

        if (query.startTimestamp) {
            listingsQuery.where('listedTimestamp').gte(Number(query.startTimestamp));
        }

        if (query.endTimestamp) {
            listingsQuery.where('listedTimestamp').lte(Number(query.endTimestamp));
        }

        if (query.user) {
            // If user is provided, filter by soldBy
            const user = await UserModel.findOne({ $or: [{ twitterId: query.user }, { _id: query.user }] });
            if (!user) {
                return {
                    status: Status.ERROR,
                    message: `(getListings) User not found.`,
                };
            }
            listingsQuery.where('user').equals(user._id);
        }

        // Execute query to fetch listings
        const listings = await listingsQuery
            .populate('user') // Populate seller information
            .limit(Number(query.limit) || 10) // Default limit of 10 if not provided
            .exec();

        return {
            status: Status.SUCCESS,
            message: `(getListings) Trade listings fetched.`,
            data: {
                listings,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getListings) ${err.message}`,
        };
    }
};

/**
 * Retrieves all active trade listings created by a specific user.
 */
export const getUserListings = async (query: ListingsQuery): Promise<ReturnValue> => {
    try {
        if (!query.user) {
            return {
                status: Status.ERROR,
                message: `(getUserListings) User identifier is required.`,
            };
        }

        const user = await UserModel.findOne({ $or: [{ twitterId: query.user }, { _id: query.user }] });
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getUserListings) User not found.`,
            };
        }

        // Create query for fetching listings by the user
        const listingsQuery = TradeListingModel.find({
            user: user._id,
            status: { $ne: TradeStatus.COMPLETED },
        });

        if (query.item) {
            listingsQuery.where('item').equals(query.item);
        }

        if (query.currency) {
            listingsQuery.where('currency').equals(query.currency);
        }

        if (query.startTimestamp) {
            listingsQuery.where('listedTimestamp').gte(Number(query.startTimestamp));
        }

        if (query.endTimestamp) {
            listingsQuery.where('listedTimestamp').lte(Number(query.endTimestamp));
        }

        // Execute query to fetch listings
        const listings = await listingsQuery
            .populate('user') // Populate seller information
            .limit(Number(query.limit) || 10) // Default limit of 10 if not provided
            .exec();

        return {
            status: Status.SUCCESS,
            message: `(getUserListings) Trade listings fetched for user.`,
            data: {
                listings,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserListings) ${err.message}`,
        };
    }
};

/**
 * Adds a trade listing to the database.
 */
export const addListing = async (data: AddListingDTO): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        // Ensure the user exists
        const user = await UserModel.findOne({ $or: [{ twitterId: data.soldBy }, { _id: data.soldBy }] }).session(
            session
        );
        if (!user) throw new Error('User not found.');

        // Get user's active listing count
        const activeListingCount = await TradeListingModel.countDocuments({
            user: user._id,
            status: { $in: [TradeStatus.ACTIVE, TradeStatus.SOLD] },
        });

        // Check if the active listing count exceed the maximum limit
        if (activeListingCount >= MAXIMUM_ACTIVE_TRADE_LISTING) {
            throw new Error(`Maximum trade listings exceeded`);
        }

        const isFood = Object.values(FoodType).includes(data.item as FoodType);

        if (isFood) {
            // Find the index of the item in the user's food inventory
            const index = (user.inventory?.foods as Food[]).findIndex((i) => i.type === data.item);

            if (index === -1) {
                throw new Error(`You don't have the specified item in your inventory.`);
            }

            if ((user.inventory?.foods as Food[])[index].amount < data.amount) {
                throw new Error(`You don't have enough of this item to list for sale.`);
            }

            // Decrease the quantity of the item in the inventory based on the amount being listed for sale
            await user.updateOne({
                $inc: { [`inventory.foods.${index}.amount`]: -data.amount },
            });
        } else {
            // Find the index of the item in the user's general inventory
            const index = (user.inventory?.items as Item[]).findIndex((i) => i.type === data.item);

            if (index === -1) {
                throw new Error(`You don't have the specified item in your inventory.`);
            }

            if ((user.inventory?.items as Item[])[index].amount < data.amount) {
                throw new Error(`You don't have enough of this item to list for sale.`);
            }

            // Decrease the quantity of the item in the inventory based on the amount being listed for sale
            await user.updateOne({
                $inc: { [`inventory.items.${index}.amount`]: -data.amount },
            });
        }

        // Create the new trade listing
        const listing = new TradeListingModel(
            {
                _id: generateObjectId(),
                user: user._id,
                item: data.item,
                amount: data.amount,
                price: data.price,
                currency: data.currency,
                listedTimestamp: Date.now(),
                status: TradeStatus.ACTIVE,
            },
            { session }
        );

        await listing.save({ session });

        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: `(addListing) Listing successfully added.`,
            data: {
                listing,
            },
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(addListing) ${err.message}`,
        };
    }
};

/**
 * Removes the reward of the listing.
 */
export const claimListing = async (listingId: string, userId: string): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        const listing = await TradeListingModel.findById(listingId);
        if (!listing) {
            throw new Error('Listing not found.');
        }

        if (listing.status === TradeStatus.COMPLETED) {
            throw new Error('The listing has already been completed.');
        }

        const user = await UserModel.findOne({ $or: [{ twitterId: userId }, { _id: userId }] });
        if (!user) {
            throw new Error('User not found.');
        }

        if (listing.user !== user._id) {
            throw new Error('You are not authorized to claim this listing.');
        }

        // Get the claimed amount by summing the unclaimed amount
        const claimedAmount = listing.purchasedBy
            .filter(({ claimed }) => !claimed)
            .reduce((prev, curr) => prev + curr.amount, 0);

        // Set the status to be Completed when the status sold
        if (listing.status === TradeStatus.SOLD) {
            listing.status = TradeStatus.COMPLETED;
        }

        const totalReward = claimedAmount * listing.price; // Calculate total reward
        if (totalReward <= 0) {
            throw new Error('Invalid reward amount.');
        }

        // Set the claimed status to 'true'
        await listing.updateOne({
            $set: {
                'purchasedBy.$[].claimed': true,
            },
        });

        // Increment user's xCookies
        await user.updateOne(
            {
                $inc: { 'inventory.xCookieData.currentXCookies': totalReward },
            },
            { session }
        );

        const index = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(
            (data) => data.source === XCookieSource.TRADING
        );

        if (index !== -1) {
            await user.updateOne(
                {
                    $set: {
                        [`inventory.xCookieData.extendedXCookieData.${index}.xCookies`]: totalReward,
                    },
                },
                { session }
            );
        } else {
            await user.updateOne(
                {
                    $push: {
                        'inventory.xCookieData.extendedXCookieData': {
                            xCookies: totalReward,
                            source: XCookieSource.TRADING,
                        },
                    },
                },
                { session }
            );
        }

        await listing.save({ session });
        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: '(claimListing) Listing claimed successfully.',
            data: {
                listing,
            },
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(claimListing) ${err.message}`,
        };
    }
};

/**
 * Cancel an active trade listing.
 */
export const cancelListing = async (listingId: string, userId: string): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        const user = await UserModel.findOne({ $or: [{ twitterId: userId }, { _id: userId }] }).session(session);
        if (!user) {
            throw new Error('User not found.');
        }

        // Check if the listing exists
        const listing = await TradeListingModel.findOne({
            _id: listingId,
            user: user._id,
            status: TradeStatus.ACTIVE,
        }).session(session);
        if (!listing) {
            throw new Error('Listing not found or already sold.');
        }

        if (listing.status === TradeStatus.COMPLETED) {
            throw new Error('The listing has already been completed.');
        }

        if (listing.user !== user._id) {
            throw new Error('You are not authorized to claim this listing.');
        }

        // Get the claimed amount by summing the unclaimed amount
        const claimedAmount = listing.purchasedBy
            .filter(({ claimed }) => !claimed)
            .reduce((prev, curr) => prev + curr.amount, 0);

        const totalReward = claimedAmount * listing.price; // Calculate total reward

        if (listing.amount > 0) {
            const isFood = Object.values(FoodType).includes(listing.item as FoodType);

            // Check if the listing item type was a food
            if (isFood) {
                // Use $inc to increase the amount of the purchased food
                await UserModel.updateOne(
                    { _id: user._id, 'inventory.foods.type': listing.item },
                    { $inc: { 'inventory.foods.$.amount': listing.amount } },
                    { session }
                );

                // If the food doesn't exist in the user's inventory, push the new food item
                await UserModel.updateOne(
                    { _id: user._id, 'inventory.foods.type': { $ne: listing.item } },
                    {
                        $push: {
                            'inventory.foods': { type: listing.item, amount: listing.amount, mintableAmount: 0 },
                        },
                    },
                    { session }
                );
            } else {
                // Use $inc to increase the amount of the purchased item
                await UserModel.updateOne(
                    { _id: user._id, 'inventory.items.type': listing.item },
                    { $inc: { 'inventory.items.$.amount': listing.amount } },
                    { session }
                );

                // If the item doesn't exist in the user's inventory, push the new item
                await UserModel.updateOne(
                    { _id: user._id, 'inventory.items.type': { $ne: listing.item } },
                    {
                        $push: {
                            'inventory.items': {
                                type: listing.item,
                                amount: listing.amount,
                                totalAmountConsumed: 0,
                                weeklyAmountConsumed: 0,
                                mintableAmount: 0,
                            },
                        },
                    },
                    { session }
                );
            }
        }

        if (totalReward > 0) {
            // Set the claimed status to 'true'
            await listing.updateOne({
                $set: {
                    'purchasedBy.$[].claimed': true,
                },
            });

            // Increment user's xCookies
            await user.updateOne(
                {
                    $inc: { 'inventory.xCookieData.currentXCookies': totalReward },
                },
                { session }
            );

            const index = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(
                (data) => data.source === XCookieSource.TRADING
            );

            if (index !== -1) {
                await user.updateOne(
                    {
                        $set: {
                            [`inventory.xCookieData.extendedXCookieData.${index}.xCookies`]: totalReward,
                        },
                    },
                    { session }
                );
            } else {
                await user.updateOne(
                    {
                        $push: {
                            'inventory.xCookieData.extendedXCookieData': {
                                xCookies: totalReward,
                                source: XCookieSource.TRADING,
                            },
                        },
                    },
                    { session }
                );
            }
        }

        // Mark the listing as completed
        listing.status = TradeStatus.COMPLETED;
        await listing.save({ session });
        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: `(cancelListing) Listing canceled successfully.`,
            data: {
                listing,
            },
        };
    } catch (err: any) {
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(cancelListing) ${err.message}`,
        };
    }
};

/**
 * Purchase items on the listing.
 */
export const purchaseListing = async (data: PurchaseListingDTO): Promise<ReturnValue> => {
    const session = await TEST_CONNECTION.startSession();
    session.startTransaction();

    try {
        const { listingId, purchaseAmount, userId } = data;

        // Check if the listing exists
        const listing = await TradeListingModel.findOne({ _id: listingId, status: TradeStatus.ACTIVE }).session(
            session
        );
        if (!listing) {
            throw new Error('Listing not found or already sold.');
        }

        // Check if the amount is available for purchase
        if (listing.amount < purchaseAmount) {
            throw new Error('Not enough quantity available.');
        }

        // Check if the purchaser is the same as the one who listed the item
        if (listing.user === userId) {
            throw new Error('You cannot buy your own listing.');
        }

        // Retrieve the user data
        const user = await UserModel.findOne({ $or: [{ twitterId: userId }, { _id: userId }] }).session(session);
        if (!user) {
            throw new Error('User not found.');
        }

        // Check if the user has enough balance (xCookies)
        const totalCost = purchaseAmount * listing.price; // Calculate total cost
        const userBalance = (user.inventory as UserInventory).xCookieData.currentXCookies;
        const hasEnoughBalance = userBalance >= totalCost;

        if (!hasEnoughBalance) {
            throw new Error('Insufficient balance for this purchase.');
        }

        // Deduct the amount from user's balance (assuming xCookies or Diamonds) using $inc
        await UserModel.updateOne(
            { _id: user._id },
            {
                $inc: {
                    'inventory.xCookieData.currentXCookies': -totalCost,
                    'inventory.xCookieData.totalXCookiesSpent': totalCost,
                    'inventory.xCookieData.weeklyXCookiesSpent': totalCost,
                },
            },
            { session }
        );

        const isFood = Object.values(FoodType).includes(listing.item as FoodType);

        // Check if the listing item type was a food
        if (isFood) {
            // Use $inc to increase the amount of the purchased food
            await UserModel.updateOne(
                { _id: user._id, 'inventory.foods.type': listing.item },
                { $inc: { 'inventory.foods.$.amount': purchaseAmount } },
                { session }
            );

            // If the food doesn't exist in the user's inventory, push the new food item
            await UserModel.updateOne(
                { _id: user._id, 'inventory.foods.type': { $ne: listing.item } },
                {
                    $push: {
                        'inventory.foods': { type: listing.item, amount: purchaseAmount, mintableAmount: 0 },
                    },
                },
                { session }
            );
        } else {
            // Use $inc to increase the amount of the purchased item
            await UserModel.updateOne(
                { _id: user._id, 'inventory.items.type': listing.item },
                { $inc: { 'inventory.items.$.amount': purchaseAmount } },
                { session }
            );

            // If the item doesn't exist in the user's inventory, push the new item
            await UserModel.updateOne(
                { _id: user._id, 'inventory.items.type': { $ne: listing.item } },
                {
                    $push: {
                        'inventory.items': {
                            type: listing.item,
                            amount: purchaseAmount,
                            totalAmountConsumed: 0,
                            weeklyAmountConsumed: 0,
                            mintableAmount: 0
                        },
                    },
                },
                { session }
            );
        }

        await TradeListingModel.updateOne(
            { _id: listing._id },
            {
                $push: {
                    purchasedBy: {
                        user: user._id,
                        amount: purchaseAmount,
                        purchasedTimestamp: Date.now(),
                        claimed: false,
                    },
                },
                $inc: { amount: -purchaseAmount }, // Decrease the amount in the listing
            },
            { session }
        );

        // If no amount is left, mark the listing as sold
        if (listing.amount - purchaseAmount <= 0) {
            await TradeListingModel.updateOne(
                { _id: listing._id },
                { $set: { status: TradeStatus.SOLD } },
                { session }
            );
        }

        // Commit the transaction to persist the changes
        await session.commitTransaction();
        session.endSession();

        return {
            status: Status.SUCCESS,
            message: `(purchaseListing) Listing purchased successfully.`,
            data: {
                listing,
                userBalance: user.wallet.balance, // Include remaining balance in the response
            },
        };
    } catch (err: any) {
        // Abort the transaction if an error occurs
        await session.abortTransaction();
        session.endSession();

        return {
            status: Status.ERROR,
            message: `(purchaseListing) ${err.message}`,
        };
    }
};
