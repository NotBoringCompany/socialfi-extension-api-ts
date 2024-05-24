import axios from 'axios';
import { UserModel } from '../utils/constants/db';
import { KOS_CONTRACT } from '../utils/constants/web3';
import { ReturnValue, Status } from '../utils/retVal';
import { getWallets } from './user';
import { KOSExplicitOwnership, KOSMetadata } from '../models/kos';

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
 * Fetches the metadata of a Key of Salvation.
 */
export const fetchKOSMetadata = async (keyId: number): Promise<ReturnValue> => {
    try {
        const response = await axios.get(`https://silver-odd-bee-580.mypinata.cloud/ipfs/bafybeift56mrglsgnouga7ufhniomqr6ibecu6nryzxiwmexiyiercnyp4/${keyId}.json`);

        // if response is not ok, return error
        if (response.status !== 200) {
            return {
                status: Status.ERROR,
                message: `(fetchKOSMetadata) Error: ${response.statusText}`
            }
        }

        const metadata = response.data;

        // convert `metadata` into a KOSMetadata instance.
        // this is an interface that contains the metadata of a Key of Salvation, such as the name, description, etc.
        const kosMetadata: KOSMetadata = {
            keyId: keyId,
            name: metadata.name,
            image: metadata.image,
            animationUrl: metadata.animation_url,
            attributes: metadata.attributes.map((attr: any) => {
                return {
                    displayType: attr.display_type ?? null,
                    traitType: attr.trait_type,
                    value: attr.value
                }
            })
        }

        console.log('metadata: ', kosMetadata)
        return {
            status: Status.SUCCESS,
            message: `(fetchKOSMetadata) Successfully fetched Key of Salvation metadata.`,
            data: {
                metadata: kosMetadata
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(fetchKOSMetadata) Error: ${err.message}`
        }
    }
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