import Bull from 'bull';
import { UserModel } from './db';

/**
 * Creates a new Bull instance for shop asset purchases and processing.
 */
export const SHOP_QUEUE = new Bull('shopQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Whenever an invoice is successfully paid with Telegram Stars, deliver the assets to the user.
 */
SHOP_QUEUE.process('deliverShopAssetViaSuccessfulTelegramStarsPayment', async (job) => {
    const { shopAsset, amount, chatId, userId, invoicePayload, telegramPaymentChargeId, providerPaymentChargeId } = job.data;

    console.log(`Delivering shop asset via successful Telegram Stars payment for user ${userId} in chat ${chatId}`);

    try {
        // a user that has only logged in with telegram will have their ID stored in `twitterId`
        // if they logged in with both telegram and twitter, it will be stored in `telegramProfile.telegramId`.
        // therefore, the query will need to check either (or) of these fields.
        const user = await UserModel.findOne({ $or: [{ twitterId: userId }, { 'telegramProfile.telegramId': userId }] });

        if (!user) {
            console.error(`(deliverShopAssetViaSuccessfulTelegramStarsPayment queue) User not found for ID ${userId}`);
            return;
        }

        // check what the shop asset gives us
    } catch (err: any) {
        console.error(`Error delivering shop asset via successful Telegram Stars payment for user ${userId} in chat ${chatId}: ${err.message}`);
    }
});