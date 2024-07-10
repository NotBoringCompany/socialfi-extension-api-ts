import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

/** instantiates the Apify client */
export const APIFY_CLIENT = new ApifyClient({ token: process.env.APIFY_API_ORGANIZATION_TOKEN! });

/**
 * temporary solution for storing cookies used for Apify's Twitter Followers actor scraper.
 */
export const APIFY_TWITTER_FOLLOWERS_COOKIES = [
    {
        domain: process.env.COOKIE_1_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_1_EXPIRATION_DATE),
        name: process.env.COOKIE_1_NAME,
        path: process.env.COOKIE_1_PATH,
        secure: process.env.COOKIE_1_SECURE === 'true',
        value: process.env.COOKIE_1_VALUE
    },
    {
        domain: process.env.COOKIE_2_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_2_EXPIRATION_DATE),
        name: process.env.COOKIE_2_NAME,
        path: process.env.COOKIE_2_PATH,
        secure: process.env.COOKIE_2_SECURE === 'true',
        value: process.env.COOKIE_2_VALUE
    },
    {
        domain: process.env.COOKIE_3_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_3_EXPIRATION_DATE),
        name: process.env.COOKIE_3_NAME,
        path: process.env.COOKIE_3_PATH,
        secure: process.env.COOKIE_3_SECURE === 'true',
        value: process.env.COOKIE_3_VALUE
    },
    {
        domain: process.env.COOKIE_4_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_4_EXPIRATION_DATE),
        name: process.env.COOKIE_4_NAME,
        path: process.env.COOKIE_4_PATH,
        secure: process.env.COOKIE_4_SECURE === 'true',
        value: process.env.COOKIE_4_VALUE
    },
    {
        domain: process.env.COOKIE_5_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_5_EXPIRATION_DATE),
        name: process.env.COOKIE_5_NAME,
        path: process.env.COOKIE_5_PATH,
        secure: process.env.COOKIE_5_SECURE === 'true',
        value: process.env.COOKIE_5_VALUE
    },
    {
        domain: process.env.COOKIE_6_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_6_EXPIRATION_DATE),
        name: process.env.COOKIE_6_NAME,
        path: process.env.COOKIE_6_PATH,
        secure: process.env.COOKIE_6_SECURE === 'true',
        value: process.env.COOKIE_6_VALUE
    },
    {
        domain: process.env.COOKIE_7_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_7_EXPIRATION_DATE),
        name: process.env.COOKIE_7_NAME,
        path: process.env.COOKIE_7_PATH,
        secure: process.env.COOKIE_7_SECURE === 'true',
        value: process.env.COOKIE_7_VALUE
    },
    {
        domain: process.env.COOKIE_8_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_8_EXPIRATION_DATE),
        name: process.env.COOKIE_8_NAME,
        path: process.env.COOKIE_8_PATH,
        secure: process.env.COOKIE_8_SECURE === 'true',
        value: process.env.COOKIE_8_VALUE
    },
    {
        domain: process.env.COOKIE_9_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_9_EXPIRATION_DATE),
        name: process.env.COOKIE_9_NAME,
        path: process.env.COOKIE_9_PATH,
        secure: process.env.COOKIE_9_SECURE === 'false',
        value: process.env.COOKIE_9_VALUE
    },
    {
        domain: process.env.COOKIE_10_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_10_EXPIRATION_DATE),
        name: process.env.COOKIE_10_NAME,
        path: process.env.COOKIE_10_PATH,
        secure: process.env.COOKIE_10_SECURE === 'true',
        value: process.env.COOKIE_10_VALUE
    },
    {
        domain: process.env.COOKIE_11_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_11_EXPIRATION_DATE),
        name: process.env.COOKIE_11_NAME,
        path: process.env.COOKIE_11_PATH,
        secure: process.env.COOKIE_11_SECURE === 'true',
        value: process.env.COOKIE_11_VALUE
    },
    {
        domain: process.env.COOKIE_12_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_12_EXPIRATION_DATE),
        name: process.env.COOKIE_12_NAME,
        path: process.env.COOKIE_12_PATH,
        secure: process.env.COOKIE_12_SECURE === 'true',
        value: process.env.COOKIE_12_VALUE
    },
    {
        domain: process.env.COOKIE_13_DOMAIN,
        expirationDate: parseInt(process.env.COOKIE_13_EXPIRATION_DATE),
        name: process.env.COOKIE_13_NAME,
        path: process.env.COOKIE_13_PATH,
        secure: process.env.COOKIE_13_SECURE === 'false',
        value: process.env.COOKIE_13_VALUE
    },
    {
        domain: process.env.COOKIE_14_DOMAIN,
        name: process.env.COOKIE_14_NAME,
        path: process.env.COOKIE_14_PATH,
        secure: process.env.COOKIE_14_SECURE === 'false',
        value: process.env.COOKIE_14_VALUE
    }
]

/**
 * Returns the input instance for the Apify Twitter Followers actor.
 * 
 * this is used for fetching the following/followers of a Twitter profile.
 */
export const APIFY_TWITTER_FOLLOWERS_INPUT = (
    twitterUsername: string,
    friendshipType: 'followers' | 'following',
    count: number,
) => {
    return {
        cookie: APIFY_TWITTER_FOLLOWERS_COOKIES,
        profileUrl: `https://twitter.com/${twitterUsername}`,
        friendshipType,
        count,
        minDelay: 1,
        maxDelay: 15
    }
}

/**
 * Returns the input instance for the Apify Twitter Profile actor.
 * 
 * This is used to fetch primarily the followers and following count of a Twitter profile.
 */
export const APIFY_TWITTER_PROFILE_INPUT = (usernames: string[]) => {
    return {
        usernames
    }
}

/** the actor ID for the Twitter Followers actor */
export const APIFY_TWITTER_FOLLOWERS_ACTOR_ID = '74Alo9YdQrNE0CVZa';
/** the actor ID for the Twitter profile actor */
export const APIFY_TWITTER_PROFILE_ACTOR_ID = 'nD89ddq3SgUPchsIO';