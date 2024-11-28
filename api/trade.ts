import { Food, FoodType } from '../models/food';
import { Item } from '../models/item';
import { TradeStatus } from '../models/trade';
import { ExtendedXCookieData, UserInventory, XCookieSource } from '../models/user';
import { TEST_CONNECTION, TradeListingModel, UserModel } from '../utils/constants/db';
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
            const user = await UserModel.findOne({ twitterId: query.user });
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

        const user = await UserModel.findOne({ twitterId: query.user });
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getUserListings) User not found.`,
            };
        }

        // Create query for fetching listings by the user
        const listingsQuery = TradeListingModel.find({
            user: user._id,
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
        const user = await UserModel.findOne({ $or: [{ twitterId: data.soldBy }, { _id: data.soldBy }] });
        if (!user) throw new Error('User not found.');

        if (!user.inventory) {
            throw new Error('User inventory is empty or invalid.');
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
            (user.inventory.foods as Food[])[index].amount -= data.amount;
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
            (user.inventory.items as Item[])[index].amount -= data.amount;
        }

        // Save the user inventory changes within the session
        await user.save({ session });

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

        // Commit the transaction
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

        const user = await UserModel.findOne({ twitterId: userId });
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

        if (claimedAmount === listing.amount) {
            listing.status = TradeStatus.COMPLETED;
        }

        const totalReward = claimedAmount * listing.price; // Calculate total reward
        if (totalReward <= 0) {
            throw new Error('Invalid reward amount.');
        }

        // Increase user's xCookies
        (user.inventory as UserInventory).xCookieData.currentXCookies += totalReward;

        const index = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(
            (data) => data.source === XCookieSource.QUEST_REWARDS
        );

        if (index !== -1) {
            (user.inventory as UserInventory).xCookieData.extendedXCookieData[index].xCookies = totalReward;
        } else {
            (user.inventory as UserInventory).xCookieData.extendedXCookieData.push({
                xCookies: totalReward,
                source: XCookieSource.QUEST_REWARDS,
            });
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
        // Check if the listing exists
        const listing = await TradeListingModel.findOne({ _id: listingId, user: userId, status: TradeStatus.ACTIVE });
        if (!listing) {
            throw new Error('Listing not found or already sold.');
        }

        // Claim the existing purchase
        await claimListing(listingId, userId);

        // Mark the listing as completed
        listing.status = TradeStatus.COMPLETED;
        await listing.save({ session });

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
        const user = await UserModel.findOne({ twitterId: userId }).session(session);
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

        // Deduct the amount from user's balance (assuming xCookies or Diamonds)
        (user.inventory as UserInventory).xCookieData.currentXCookies -= totalCost;
        (user.inventory as UserInventory).xCookieData.totalXCookiesSpent += totalCost;
        (user.inventory as UserInventory).xCookieData.weeklyXCookiesSpent += totalCost;

        const isFood = Object.values(FoodType).includes(listing.item as FoodType);

        // Check if the listing item type was a food
        if (isFood) {
            const index = (user.inventory?.foods as Food[]).findIndex((i) => i.type === listing.item);

            if (index !== -1) {
                (user.inventory.foods as Food[])[index].amount += purchaseAmount;
            } else {
                user.inventory.foods.push({
                    type: listing.item,
                    amount: purchaseAmount,
                });
            }
        } else {
            const index = (user.inventory?.items as Item[]).findIndex((i) => i.type === listing.item);

            if (index !== -1) {
                (user.inventory.items as Item[])[index].amount += purchaseAmount;
            } else {
                user.inventory.items.push({
                    type: listing.item,
                    amount: purchaseAmount,
                    totalAmountConsumed: 0,
                    weeklyAmountConsumed: 0,
                });
            }
        }

        await user.save({ session });

        // Add the purchase to the listing
        listing.purchasedBy?.push({
            user: user._id,
            amount: purchaseAmount,
            purchasedTimestamp: Date.now(),
            claimed: false,
        });

        // Decrease the amount of the item based on the purchase amount
        listing.amount -= purchaseAmount;

        // If no amount is left, mark the listing as sold
        if (listing.amount <= 0) {
            listing.status = TradeStatus.SOLD;
        }

        // Save the updated listing
        await listing.save({ session });

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
