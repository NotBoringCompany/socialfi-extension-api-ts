import Bull from 'bull';

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
    const { chatId, userId, invoicePayload, telegramPaymentChargeId, providerPaymentChargeId } = job.data;

    console.log(`Delivering shop asset via successful Telegram Stars payment for user ${userId} in chat ${chatId}`);

    try {

    } catch (err: any) {
        console.error(`Error delivering shop asset via successful Telegram Stars payment for user ${userId} in chat ${chatId}: ${err.message}`);
    }
});