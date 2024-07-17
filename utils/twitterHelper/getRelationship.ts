import axios from 'axios';
import { ReturnValue, Status } from '../retVal';

/**
 * Represent the structure of relationship data returned by the API.
 */
interface RelationshipData {
    source: {
        id: number;
        id_str: string;
        screen_name: string;
        following: boolean;
        followed_by: boolean;
        live_following: boolean;
        following_received: boolean | null;
        following_requested: boolean | null;
        notifications_enabled: boolean | null;
        can_dm: boolean;
        can_media_tag: boolean | null;
        blocking: boolean | null;
        blocked_by: boolean | null;
        muting: boolean | null;
        want_retweets: boolean | null;
        all_replies: boolean | null;
        marked_spam: boolean | null;
    };
    target: {
        id: number;
        id_str: string;
        screen_name: string;
        following: boolean;
        followed_by: boolean;
        following_received: boolean | null;
        following_requested: boolean | null;
    };
}

/**
 * Represent the input parameters for fetching relationship data.
 */
interface RelationshipInput {
    source_id?: string;
    source_screen_name?: string;
    target_id?: string;
    target_screen_name?: string;
}

/**
 * Fetches the relationship data between two Twitter users.
 * @param input - The input parameters containing either user IDs or screen names.
 * @returns A promise that resolves to a ReturnValue containing the relationship data.
 */
export async function getRelationship(input: RelationshipInput): Promise<ReturnValue<RelationshipData>> {
    const apiKey = process.env.TWITTER_HELPER_API_KEY;

    const params = new URLSearchParams({
        apiKey: apiKey ?? '',
        source_id: input.source_id,
        target_id: input.target_id,
        source_screen_name: input.source_screen_name,
        target_screen_name: input.target_screen_name,
    });

    const url = `https://twitter.good6.top/api/base/apitools/friendshipsShow?${params.toString()}`;

    try {
        const response = await axios.get(url, {
            headers: {
                accept: '*/*',
            },
        });

        if (response.data.code === 1 && response.data.msg === 'SUCCESS') {
            // Parse the relationship data from the response
            const relationshipData: RelationshipData = JSON.parse(response.data.data).relationship;
            return {
                status: Status.SUCCESS,
                message: 'Data fetched successfully',
                data: relationshipData,
            };
        } else {
            return {
                status: Status.ERROR,
                message: `Error fetching data: ${response.data.msg}`,
            };
        }
    } catch (error) {
        return {
            status: Status.ERROR,
            message: `Error fetching data: ${error.message}`,
        };
    }
}
