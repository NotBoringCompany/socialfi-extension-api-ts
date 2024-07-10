import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';
import { APIFY_CLIENT, APIFY_TWITTER_FOLLOWERS_ACTOR_ID, APIFY_TWITTER_FOLLOWERS_COOKIES, APIFY_TWITTER_PROFILE_ACTOR_ID, APIFY_TWITTER_PROFILE_INPUT } from '../utils/constants/apify';
import { ReturnValue, Status } from '../utils/retVal';
import { UserModel } from '../utils/constants/db';
import mongoose from 'mongoose';

dotenv.config();

// (async () => {
//     try {
//         const run = await client.actor('74Alo9YdQrNE0CVZa').call(input);

//     console.log('Results from dataset');
//     const { items } = await client.dataset(run.defaultDatasetId).listItems();
//     console.log('items length: ', items.length);
//     console.log(items);

//     } catch (err: any) {
//         console.log(err);
//     }
// })();

/**
 * Fetches all the twitter accounts a user is following.
 */
export const fetchTwitterFollowing = async (twitterId: string): Promise<ReturnValue> => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);

        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(fetchTwitterFollowing) User not found.`
            }
        }

        const twitterUsername = user?.twitterUsername;

        if (!twitterUsername) {
            return {
                status: Status.ERROR,
                message: `(fetchTwitterFollowing) Twitter username not found.`
            }
        }

        const twitterProfileInput = APIFY_TWITTER_PROFILE_INPUT([twitterUsername]);

        // to do:
        // 1. call the twitter profile actor to fetch the following count of the user.
        // 2. fetch the twitter followers actor to fetch the followers of the user, limiting the search to the following count.
        // 3. check if the followers include wonderverse.

        const twitterProfileRun = await APIFY_CLIENT.actor(APIFY_TWITTER_PROFILE_ACTOR_ID).call(twitterProfileInput);

        const { items } = await APIFY_CLIENT.dataset(twitterProfileRun.defaultDatasetId).listItems();

        /// rest to do
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(fetchTwitterFollowing) ${err.message}`
        }
    }
}