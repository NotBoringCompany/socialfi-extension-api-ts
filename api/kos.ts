import axios from 'axios';
import { UserModel } from '../utils/constants/db';
import { KOS_CONTRACT } from '../utils/constants/web3';
import { ReturnValue, Status } from '../utils/retVal';
import { getWallets } from './user';
import { KOSExplicitOwnership, KOSMetadata } from '../models/kos';
import { KOS_METADATA } from '../utils/constants/kos';
import fs from 'fs';
import path from 'path';

/**
 * Gets all Key of Salvation IDs owned by the user (main + secondary wallets).
 */
export const getOwnedKeyIDs = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const { status, message, data } = await getWallets(twitterId);

        if (status !== Status.SUCCESS) {
            console.log('get wallets success. wallets: ', data.walletAddresses);
            return {
                status,
                message
            }
        }

        // loop through each wallet address and get the key IDs owned (call `tokensOfOwner` in the contract)
        const keyIDs: string[] = [];

        // for each wallet address, call `tokensOfOwner` in the contract and add the key IDs to `keyIDs`
        for (const walletAddress of data.walletAddresses) {
            const ownedIds = await KOS_CONTRACT.tokensOfOwner(walletAddress as string);

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

/**
 * Fetches all metadata of the Key of Salvation NFTs from the kosMetadata.json file.
 */
export const fetchKOSMetadataFile = (): KOSMetadata[] => {
    const metadataFile = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '../utils/kosMetadata.json'), 'utf8')
        ) as KOSMetadata[];

    return metadataFile;
}

/**
 * Checks the start of ownership of one or multiple keys.
 */
export const checkKeyOwnerships = async (keyIds: number[]): Promise<ReturnValue> => {
    try {
        // call `explicitOwnershipsOf` in the contract for all key IDs and convert it to use `KOSExplicitOwnership`
        const keyOwnerships = await KOS_CONTRACT.explicitOwnershipsOf(keyIds);

        const formattedOwnerships: KOSExplicitOwnership[] = keyOwnerships.map((ownership: any) => {
            return {
                owner: ownership.addr,
                // convert startTimestamp to unix
                startTimestamp: ownership.startTimestamp.toNumber(),
                burned: ownership.burned,
                extraData: ownership.extraData
            }
        })

        return {
            status: Status.SUCCESS,
            message: `(checkKeyOwnerships) Successfully checked key ownerships.`,
            data: {
                keyOwnerships: formattedOwnerships
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkKeyOwnerships) Error: ${err.message}`
        }
    }
}