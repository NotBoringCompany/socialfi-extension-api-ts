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

const fetchShopQueueData = async (): Promise<void> => {
    const waitingJobs = await SHOP_QUEUE.getWaiting();
    const activeJobs = await SHOP_QUEUE.getActive();
    const completedJobs = await SHOP_QUEUE.getCompleted();
    const failedJobs = await SHOP_QUEUE.getFailed();

    console.log(`(Shop Queue) Waiting jobs: ${waitingJobs.length}`);
    console.log(`(Shop Queue) Active jobs: ${activeJobs.length}`);
    console.log(`(Shop Queue) Completed jobs: ${completedJobs.length}`);
    console.log(`(Shop Queue) Completed jobs: ${JSON.stringify(completedJobs, null, 2)}`);
    console.log(`(Shop Queue) Failed jobs: ${failedJobs.length}`);
}

fetchShopQueueData();