import { UserModel } from '../utils/constants/db';
import { KOS_CONTRACT } from '../utils/constants/web3';
import { ReturnValue, Status } from '../utils/retVal';
import { getWallets } from './user';

/**
 * Gets all Key of Salvation IDs owned by the user (main + secondary wallets).
 */
export const getOwnedKeyIDs = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const { status, message, data } = await getWallets(twitterId);

        if (status !== Status.SUCCESS) {
            return {
                status,
                message
            }
        }

        // loop through each wallet address and get the key IDs owned (call `tokensOfOwner` in the contract)
        const keyIDs: string[] = [];

        // for each wallet address, call `tokensOfOwner` in the contract and add the key IDs to `keyIDs`
        for (const walletAddress of data.walletAddresses) {
            const ownedIds = await KOS_CONTRACT.tokensOfOwner(walletAddress);

            keyIDs.push(...ownedIds);
        }

        return {
            status: Status.SUCCESS,
            message: `(getOwnedKeys) Successfully retrieved owned Key of Salvation IDs.`,
            data: {
                ownedKeyIDs: keyIDs
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getOwnedKeys) Error: ${err.message}`
        }
    }
}