import axios from 'axios';
import { ReturnValue, Status } from '../utils/retVal';
import { BitModel, IslandModel, ShopAssetPurchaseModel, UserBitCosmeticModel, UserModel } from '../utils/constants/db';
import { ExtendedXCookieData, UserSecondaryWallet, UserWallet, XCookieSource } from '../models/user';
import { getUserCurrentPoints } from './leaderboard';
import { BINANCE_API_BASE_URL, BIT_COSMETICS_CONTRACT, BIT_COSMETICS_CONTRACT_USER, CUSTODIAL_CONTRACT, CUSTODIAL_CONTRACT_USER, DEPLOYER_WALLET, GATEIO_API_BASE_URL, ISLANDS_CONTRACT, ISLANDS_CONTRACT_USER, KAIA_TESTNET_PROVIDER, KUCOIN_API_BASE_URL, TON_RECEIVER_ADDRESS, TON_WEB, WONDERBITS_CONTRACT, WONDERBITS_CONTRACT_USER, WONDERBITS_SFT_CONTRACT, WONDERBITS_SFT_CONTRACT_USER, WONDERBITS_SFT_IDS, XPROTOCOL_TESTNET_PROVIDER } from '../utils/constants/web3';
import { ethers } from 'ethers';
import { TxParsedMessage } from '../models/web3';
import { ShopAssetPurchaseConfirmationAttemptType } from '../models/shop';
import { Item } from '../models/item';
import { Food } from '../models/food';
import { AssetType } from '../models/asset';
import { decryptPrivateKey, generateHashSalt, generateOpHash } from '../utils/crypto';
import { ExtendedResource, ExtendedResourceOrigin, Resource } from '../models/resource';
import { resources } from '../utils/constants/resource';

/**
 * Sets `usable` to `true` by default for all to-be-NFT assets (islands, bits and bit cosmetics) in the database.
 */
export const addUsableToNFTs = async (): Promise<void> => {
    try {
        await IslandModel.updateMany({}, {
            $set: {
                'usable': true
            }
        });

        await BitModel.updateMany({}, {
            $set: {
                'usable': true
            }
        });

        await UserBitCosmeticModel.updateMany({}, {
            $set: {
                'usable': true
            }
        });

        console.log(`(addUsableToNFTs) Successfully set all NFTs to be usable.`);
    } catch (err: any) {
        console.error(`(addUsableToNFTs) ${err.message}`);
    }
}

/**
 * Converts a BOC (bag of cells) for TON-related transactions into its corresponding transaction hash in hex format.
 */
export const bocToTxHash = async (boc: string): Promise<string> => {
    try {
        // convert base64-encoded boc string into byte array
        const bocBytes = TON_WEB.utils.base64ToBytes(boc);
        // decode boc into a single TON cell (`boc` should only contain one cell)
        const cell = TON_WEB.boc.Cell.oneFromBoc(bocBytes);
        // calculate hash of cell to get the tx hash
        const rawHash = await cell.hash();
        // `rawHash` is still a bytes array; convert to hex
        const hash = TON_WEB.utils.bytesToHex(rawHash);

        return hash;
    } catch (err: any) {
        throw new Error(`(bocToTxHash) ${err.message}`);
    }
}

/**
 * Verifies a transaction made in TON (and optionally rewards the user the items they purchased upon specific errors).
 * 
 * Required parameters: `address`, `boc`.
 * 
 * If this is a first verification attempt (i.e. `reverification` is set to `false`), then these additional params are required:
 * `assetName`, `amount`.
 * 
 * If the `reverification` flag is set to `true`, this means that the initial reverification attempt failed and we're trying again.
 * In this case, these additional params are required: `purchaseId`.
 * 
 * If `reverification` is set to `true`, database operations to ShopAssetPurchase will be done to update the `blockchainData.confirmationAttempts` array and potentially the `blockchainData.txPayload` field.
 */
export const verifyTONTransaction = async (
    address: string, 
    boc: string, 
    assetName?: string,
    amount?: number,
    reverification: boolean = false,
    purchaseId?: string
): Promise<ReturnValue> => {
    if (!address || address === '') {
        console.error(`(verifyTONTransaction) Address not found.`);
        return {
            status: Status.ERROR,
            message: `(verifyTONTransaction) Address not found.`
        }
    }

    if (!boc || boc === '') {
        console.error(`(verifyTONTransaction) BOC not found.`);
        return {
            status: Status.ERROR,
            message: `(verifyTONTransaction) BOC not found.`
        }
    }

    if (!reverification && (!assetName || assetName === '' || !amount || amount === 0 || amount < 0)) {
        console.error(`(verifyTONTransaction) Asset name or amount not found/invalid.`);
        return {
            status: Status.ERROR,
            message: `(verifyTONTransaction) Asset name or amount not found/invalid.`
        }
    }

    // only check for `purchaseId` if this is a reverification attempt
    if (reverification && (!purchaseId || purchaseId === '')) {
        console.error(`(verifyTONTransaction) Purchase ID not found for reverification attempt.`);
        return {
            status: Status.ERROR,
            message: `(verifyTONTransaction) Purchase ID not found for reverification attempt.`
        }
    }

    try {
        const txHash = await bocToTxHash(boc).catch(async err => {
            // if an error occurs here, it's most likely due to the API. return an API error.
            console.error(`(verifyTONTransaction) Error most likely from API: ${err.message}`);

            // if reverification, then update the purchase's `blockchainData.confirmationAttempts` to include the error `apiError`
            if (reverification) {
                const update = await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                    $push: {
                        'blockchainData.confirmationAttempts': ShopAssetPurchaseConfirmationAttemptType.API_ERROR
                    }
                });

                // check if `update` is successful. if not, log the error.
                if (!update) {
                    console.error(`(verifyTONTransaction) API Error + Error updating confirmation attempts for purchase ID: ${purchaseId}`);

                    return {
                        status: Status.ERROR,
                        message: `(verifyTONTransaction) API Error + Error updating confirmation attempts for purchase ID: ${purchaseId}`
                    }
                }

                return {
                    status: Status.ERROR,
                    message: `(verifyTONTransaction) API Error. Possible rate limiting from TON node provider.`
                }
            }

            return {
                status: Status.ERROR,
                message: `(verifyTONTransaction) API Error. Possible rate limiting from TON node provider.`
            }
        })

        console.log(`tx hash: ${txHash}`);
        console.log(`Address to verify transactions: ${address}`);

        // `getTransactions` will return an array of transactions, even if we're only fetching one transaction
        const txs = await TON_WEB.provider.getTransactions(
            address,
            1,
            null,
            // because `txHash` will already return early if an error is caught, we can safely force cast `txHash` to a string.
            txHash as string
        ).catch(async err => {
            // if an error occurs here, it's most likely due to the API. return an API error.
            console.error(`(verifyTONTransaction) Error getting user's transactions: ${err.message}`);

            // if reverification, then update the purchase's `blockchainData.confirmationAttempts` to include the error `apiError`
            if (reverification) {
                const update = await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                    $push: {
                        'blockchainData.confirmationAttempts': ShopAssetPurchaseConfirmationAttemptType.API_ERROR
                    }
                });

                // check if `update` is successful. if not, log the error.
                if (!update) {
                    console.error(`(verifyTONTransaction) API error + Error updating confirmation attempts for purchase ID: ${purchaseId}`);

                    return {
                        status: Status.ERROR,
                        message: `(verifyTONTransaction) API error + Error updating confirmation attempts for purchase ID: ${purchaseId}`
                    }
                }

                return {
                    status: Status.ERROR,
                    message: `(verifyTONTransaction) API Error. Possible rate limiting from TON node provider.`
                }
            }

            return {
                status: Status.ERROR,
                message: `(verifyTONTransaction) API Error. Possible rate limiting from TON node provider.`
            }
        })

        // fetch the transaction (bc it's in an array, we simply get the first index)
        const firstTx = txs[0];

        // if transaction is not found, then return an error
        if (!firstTx) {
            console.error(`(verifyTONTransaction) Transaction not found. Address: ${address}, BOC: ${boc}`);

            // if reverification, then update the purchase's `blockchainData.confirmationAttempts` to include the error `noValidTx`
            if (reverification) {
                await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                    $push: {
                        'blockchainData.confirmationAttempts': ShopAssetPurchaseConfirmationAttemptType.NO_VALID_TX
                    }
                });
            }

            return {
                status: Status.ERROR,
                message: `(verifyTONTransaction) Transaction not found. Address: ${address}, BOC: ${boc}`
            }
        }

        console.log(`first tx: ${JSON.stringify(firstTx, null, 2)}`);

        // set `isBounceable` to false to match the address format in TONKeeper
        const receiverAddress: string = new TON_WEB.utils.Address(firstTx?.out_msgs[0]?.destination)?.toString(true, true, false, false);

        console.log(`receiver address: ${receiverAddress}`);

        // get the parsed message body of the transaction (containing the asset, amount purchased and total cost)
        const txParsedMessage: TxParsedMessage = JSON.parse(firstTx?.out_msgs[0]?.message);

        console.log(`tx parsed message: ${JSON.stringify(txParsedMessage, null, 2)}`);

        // get the value of the transaction (amount supposedly sent to `receiverAddress`)
        const txValue = firstTx?.out_msgs[0]?.value;

        console.log(`tx value: ${txValue}`);

        // check if the receiver address matches the Wonderbits receiver address
        if (receiverAddress !== TON_RECEIVER_ADDRESS) {
            console.error(`(verifyTONTransaction) Receiver address mismatch. Expected: ${TON_RECEIVER_ADDRESS}, got: ${receiverAddress}`);

            // if reverification, then update the purchase's `blockchainData.confirmationAttempts` to include the error `noValidTx`
            if (reverification) {
                await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                    $push: {
                        'blockchainData.confirmationAttempts': ShopAssetPurchaseConfirmationAttemptType.NO_VALID_TX
                    },
                    'blockchainData.txPayload': txParsedMessage
                });
            }

            return {
                status: Status.ERROR,
                message: `(verifyTONTransaction) Receiver address mismatch. Expected: ${TON_RECEIVER_ADDRESS}, got: ${receiverAddress}`,
                data: {
                    txPayload: txParsedMessage ?? null
                }
            }
        }

        // if the currency is "TON", then `txValue` MUST be the same as `txParsedMessage.cost`
        // because the cost of the transaction should be the same as the value sent to the receiver (value = native currency of the tx, which is TON)
        // if NOT or other coins, then value most likely won't match because it's not paid with TON (so TBD).
        if (txParsedMessage.curr === 'TON') {
            const parsedMessageCost = txParsedMessage.cost;

            // 1 ton is equal to 10^9 nanotons
            // we divide by 10^9 to get the actual value in TON
            if (parsedMessageCost !== (parseInt(txValue) / Math.pow(10, 9))) {
                console.error(`(verifyTONTransaction) Value mismatch. Parsed message cost: ${parsedMessageCost}, tx value: ${txValue / Math.pow(10, 9)}`);

                // if reverification, then update the purchase's `blockchainData.confirmationAttempts` to include the error `PAYMENT_MISMATCH`
                if (reverification) {
                    await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                        $push: {
                            'blockchainData.confirmationAttempts': ShopAssetPurchaseConfirmationAttemptType.PAYMENT_MISMATCH
                        },
                        'blockchainData.txPayload': txParsedMessage
                    });
                }

                return {
                    status: Status.ERROR,
                    message: `(verifyTONTransaction) Value mismatch. Currency paid: ${txParsedMessage.curr}. Parsed message cost: ${parsedMessageCost}, tx value: ${(parseInt(txValue) / Math.pow(10, 9))}`,
                    data: {
                        txPayload: txParsedMessage ?? null
                    }
                }
            }
        /// TO DO!!!!!!!!!! IMPLEMENT OTHER CURRENCIES LIKE NOT, ETC HERE.
        } else {
            console.log(`(verifyTONTransaction) Currency is not TON. Not developed yet. Currency: ${txParsedMessage.curr}`);
            
            // in this case, throw an error because it's not developed yet.
            return {
                status: Status.ERROR,
                message: `(verifyTONTransaction) Currency is not TON. Currency: ${txParsedMessage.curr}`,
                data: {
                    txPayload: txParsedMessage ?? null
                }
            }
        }

        // finally, check if the items given to the user match the items purchased (by checking the `txParsedMessage.asset` compared to the `assetName`)
        // and if the amount of the asset given to the user matches the amount purchased (by checking the `txParsedMessage.amt` compared to the `amount`)
        if (txParsedMessage.asset.toLowerCase() !== assetName.toLowerCase() || txParsedMessage.amt !== amount) {
            console.error(`(verifyTONTransaction) Asset mismatch. Parsed message asset: ${txParsedMessage.asset}, purchase asset: ${assetName}. Parsed message amount: ${txParsedMessage.amt}, purchase amount: ${amount}`);

            // if reverification, then update the purchase's `blockchainData.confirmationAttempts` to include the error `itemMismatch`
            if (reverification) {
                await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                    $push: {
                        'blockchainData.confirmationAttempts': ShopAssetPurchaseConfirmationAttemptType.ASSET_MISMATCH
                    },
                    'blockchainData.txPayload': txParsedMessage
                });
            }

            return {
                status: Status.ERROR,
                message: `(verifyTONTransaction) Asset mismatch. Parsed message asset: ${txParsedMessage.asset}, purchase asset: ${assetName}. Parsed message amount: ${txParsedMessage.amt}, purchase amount: ${amount}`,
                data: {
                    txPayload: txParsedMessage ?? null
                }
            }
        }

        // if all checks pass, verification is successful.
        // if reverification, then update the purchase's `blockchainData.confirmationAttempts` to include the status `success`
        // and update the `blockchainData.txPayload` to the parsed message.
        // additionally, if the `confirmationAttempts` up to this point ONLY contains `apiError`, then reward the user the items they purchased
        // because that means that they were unable to receive the items due to an API error.
        if (reverification) {
            // get the purchase data
            const purchaseData = await ShopAssetPurchaseModel.findById(purchaseId).lean();

            if (!purchaseData) {
                // here we can't update the `confirmationAttempts` because the purchase wasn't found.
                // so we log just in case.
                console.error(`(verifyTONTransaction) Purchase not found. Address: ${address}, BOC: ${boc}, Purchase ID: ${purchaseId}`);
                return {
                    status: Status.ERROR,
                    message: `(verifyTONTransaction) Purchase not found. Purchase ID: ${purchaseId}`,
                    data: {
                        txPayload: txParsedMessage ?? null
                    }
                }
            }

            // if the `confirmationAttempts` array only contains `apiError`, then reward the user the items they purchased
            // because that means that they were unable to receive the items due to an API error or DB-related errors.
            if (purchaseData.blockchainData.confirmationAttempts.every(attempt => attempt === 'apiError')) {
                const user = await UserModel.findOne({ _id: purchaseData.userId }).lean();

                if (!user) {
                    // if user is not found, then we can't give them the items they purchased.
                    // we will have to add `userNotFound` to the `confirmationAttempts` array.
                    await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                        $push: {
                            'blockchainData.confirmationAttempts': ShopAssetPurchaseConfirmationAttemptType.USER_NOT_FOUND
                        }
                    });

                    console.error(`(verifyTONTransaction) User not found. User ID: ${purchaseData.userId}, BOC: ${boc}, Purchase ID: ${purchaseId}`);
                    return {
                        status: Status.ERROR,
                        message: `(verifyTONTransaction) User not found. User ID: ${purchaseData.userId}`,
                        data: {
                            txPayload: txParsedMessage ?? null
                        }
                    }
                }

                const userUpdateOperations = {
                    $push: {
                        'inventory.items': { $each: [] },
                        'inventory.foods': { $each: [] },
                    },
                    $inc: {}
                }

                // loop through each content and give the user the assets they were supposed to receive
                for (const givenContent of purchaseData.givenContents) {
                    // get the content type (item, food, etc.)
                    if (givenContent.contentType === 'item') {
                        // give the user the items they purchased
                        // add the item to the user's inventory
                        const existingItemIndex = (user.inventory?.items as Item[]).findIndex(i => i.type === givenContent.content);
    
                        if (existingItemIndex !== -1) {
                            userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = givenContent.amount;
                        } else {
                            userUpdateOperations.$push['inventory.items'].$each.push({
                                type: givenContent.content, 
                                amount: givenContent.amount,
                                totalAmountConsumed: 0,
                                weeklyAmountConsumed: 0
                            });
                        }
                    } else if (givenContent.contentType === 'food') {
                        // add the food to the user's inventory
                        const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex(f => f.type === givenContent.content);
    
                        if (existingFoodIndex !== -1) {
                            userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = givenContent.amount;
                        } else {
                            userUpdateOperations.$push['inventory.foods'].$each.push({ type: givenContent.content, amount: givenContent.amount });
                        }
                    } else if (givenContent.contentType === 'igc') {
                        // check if xCookies.
                        if (givenContent.content === 'xCookies') {
                            // add the xCookies to the user's currentXCookies
                            userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = givenContent.amount;
                            // check if the `extendedXCookieData` contains the source SHOP_PURCHASE. if not, add it. if yes, increment the amount.
                            const shopPurchaseIndex = (user.inventory?.xCookieData?.extendedXCookieData as ExtendedXCookieData[]).findIndex(data => data.source === XCookieSource.SHOP_PURCHASE);
    
                            if (shopPurchaseIndex !== -1) {
                                userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${shopPurchaseIndex}.xCookies`] = givenContent.amount;
                            } else {
                                userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = { source: XCookieSource.SHOP_PURCHASE, xCookies: givenContent.amount };
                            }
                        } else if (givenContent.content === 'diamonds') {
                            // NOT IMPLEMENTED YET. TBD.
                            console.error(`(verifyTONTransaction) Content not implemented yet. Content: ${givenContent.content}`);
    
                            return {
                                status: Status.ERROR,
                                message: `(verifyTONTransaction) Content not implemented yet. Content: ${givenContent.content}`,
                                data: {
                                    txPayload: txParsedMessage ?? null
                                }
                            }
                        } else {
                            // NOT IMPLEMENTED YET (other IGCs). TBD.
                            console.error(`(verifyTONTransaction) Content not implemented yet. Content: ${givenContent.content}`);
    
                            return {
                                status: Status.ERROR,
                                message: `(verifyTONTransaction) Content not implemented yet. Content: ${givenContent.content}`,
                                data: {
                                    txPayload: txParsedMessage ?? null
                                }
                            }
                        }
                    } else if (givenContent.contentType === 'wonderpass') {
                        // NOT IMPLEMENTED YET. TBD.
                        console.error(`(verifyTONTransaction) Content not implemented yet. Content: ${givenContent.content}`);
    
                        return {
                            status: Status.ERROR,
                            message: `(verifyTONTransaction) Content not implemented yet. Content: ${givenContent.content}`,
                            data: {
                                txPayload: txParsedMessage ?? null
                            }
                        }
                    } else {
                        // NOT IMPLEMENTED YET. TBD.
                        console.error(`(verifyTONTransaction) Content not implemented yet. Content: ${givenContent.content}`);
    
                        return {
                            status: Status.ERROR,
                            message: `(verifyTONTransaction) Content not implemented yet. Content: ${givenContent.content}`,
                            data: {
                                txPayload: txParsedMessage ?? null
                            }
                        }
                    }
                }

                // update the user's data (divide by push and pull to ensure that the data is updated correctly)
                // check if $inc is empty. if not, call `findByIdAndUpdate` with $inc.
                if (Object.keys(userUpdateOperations.$inc).length > 0) {
                    await UserModel.findByIdAndUpdate(user._id, {
                        $inc: userUpdateOperations.$inc,
                    });
                }

                // check if $push is empty. if not, call `findByIdAndUpdate` with $push.
                if (Object.keys(userUpdateOperations.$push).length > 0) {
                    await UserModel.findByIdAndUpdate(user._id, {
                        $push: userUpdateOperations.$push
                    });
                }
            }

            await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                $push: {
                    'blockchainData.confirmationAttempts': ShopAssetPurchaseConfirmationAttemptType.SUCCESS
                },
                'blockchainData.txPayload': txParsedMessage,
                // also update the actualCost and actualCurrency even if it was already updated before (just to finalize from the payload).
                'blockchainData.actualCost': txParsedMessage.cost,
                'blockchainData.actualCurrency': txParsedMessage.curr
            });
        }

        console.log(`(verifyTONTransaction) Transaction verified successfully for address: ${address}.`);

        return {
            status: Status.SUCCESS,
            message: `(verifyTONTransaction) Transaction verified successfully.`,
            data: {
                txPayload: txParsedMessage ?? null
            }
        }
    } catch (err: any) {
        console.error(`(verifyTONTransaction) Error outside of all other errors handled: ${err.message}`);

        return {
            status: Status.ERROR,
            message: `(verifyTONTransaction) Error outside of all other errors handled: ${err.message}`
        }
    }
}

/**
 * Fetches the tickers of the tokens used for in-app purchases in Wonderbits.
 * 
 * Currently, this consists of TON and NOT.
 */
export const fetchIAPTickers = async (): Promise<ReturnValue> => {
    // URL to fetch the tickers via Binance API
    const BINANCE_URL = `${BINANCE_API_BASE_URL}/api/v3/ticker/price?symbols=["TONUSDT","NOTUSDT"]`;
    // URL to fetch the tickers via KuCoin API (requires 2 because KuCoin doesn't support multiple symbols in one request)
    const KUCOIN_URLS = [`${KUCOIN_API_BASE_URL}/api/v1/market/orderbook/level1?symbol=TON-USDT`, `${KUCOIN_API_BASE_URL}/api/v1/market/orderbook/level1?symbol=NOT-USDT`];
    // URL to fetch the tickers via Gate.io API (requires 2 because Gate.io doesn't support multiple symbols in one request)
    const GATEIO_URLS = [`${GATEIO_API_BASE_URL}/api/v4/spot/tickers?currency_pair=TON_USDT`, `${GATEIO_API_BASE_URL}/api/v4/spot/tickers?currency_pair=NOT_USDT`];

    try {
        // logic is as follows:
        // 1. attempt to do a GET request to the Binance API to fetch the tickers for TON and NOT.
        // 2. if the request fails (especially if it's 429), try the KuCoin API.
        // 3. if the request fails (especially if it's 429), try the Gate.io API.
        // 4. if all requests fail, return an error.
        // 5. upon success, round tickers up to 3 decimal places and return the data.
        
        const binanceResponse = await axios.get(BINANCE_URL);

        // if the request is successful, return the response, else try KuCoin
        if (binanceResponse.status === 200) {
            // binance returns an array of objects with their symbol and price (tickers). we need to extract the price for TON and NOT
            // find the data with `chosenCurrency` = TON
            const TONTicker = binanceResponse.data.find((data: any) => data.symbol === 'TONUSDT')?.price;
            // find the data with `chosenCurrency` = NOT
            const NOTTicker = binanceResponse.data.find((data: any) => data.symbol === 'NOTUSDT')?.price;

            return {
                status: Status.SUCCESS,
                message: `(fetchIAPTickers) Tickers fetched successfully.`,
                data: {
                    TONTicker: Math.ceil(parseFloat(TONTicker) * 1000) / 1000,
                    NOTTicker: Math.ceil(parseFloat(NOTTicker) * 1000) / 1000
                }
            }
        }

        // if the request fails, try KuCoin
        console.log(`(fetchIAPTickers) Binance API failed. Trying KuCoin API...`);

        const kuCoinResponses = await Promise.all(KUCOIN_URLS.map(url => axios.get(url)));

        // if all requests are successful, return the response, else try Gate.io
        if (kuCoinResponses.every(response => response.status === 200)) {
            // kuCoin returns an object with the symbol and price. we need to extract the price for TON and NOT
            const TONTicker = kuCoinResponses[0].data.data.price;
            const NOTTicker = kuCoinResponses[1].data.data.price;

            return {
                status: Status.SUCCESS,
                message: `(fetchIAPTickers) Tickers fetched successfully.`,
                data: {
                    TONTicker: Math.ceil(parseFloat(TONTicker) * 1000) / 1000,
                    NOTTicker: Math.ceil(parseFloat(NOTTicker) * 1000) / 1000
                }
            }
        }

        // only IF all requests are successful, return the response, else try Gate.io
        console.log(`(fetchIAPTickers) Binance and KuCoin API failed. Trying Gate.io API...`);

        const gateIOResponses = await Promise.all(GATEIO_URLS.map(url => axios.get(url)));

        // if all requests are successful, return the response, else return an error
        if (gateIOResponses.every(response => response.status === 200)) {
            // gate.io returns an object with the symbol and price. we need to extract the price for TON and NOT
            const TONTicker = gateIOResponses[0].data[0].last;
            const NOTTicker = gateIOResponses[1].data[0].last;

            return {
                status: Status.SUCCESS,
                message: `(fetchIAPTickers) Tickers fetched successfully.`,
                data: {
                    TONTicker: Math.ceil(parseFloat(TONTicker) * 1000) / 1000,
                    NOTTicker: Math.ceil(parseFloat(NOTTicker) * 1000) / 1000
                }
            }
        }

        // if all requests fail, return an error
        return {
            status: Status.ERROR,
            message: `(fetchIAPTickers) Failed to fetch tickers. APIs may not be working now. Please try again later.`
        }
    } catch (err: any) {
        console.log(`(fetchIAPTickers) Error: ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(fetchIAPTickers) ${err.message}`
        }
    }
}

/**
 * Mints a bit into the Kaia Testnet blockchain for the user.
 */
export const mintBit = async (twitterId: string, bitId: number): Promise<ReturnValue> => {
    try {
        // get the user's data
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(mintBit) User not found.`
            }
        }

        // check if the user owns the bit
        if (!(user.inventory?.bitIds as number[]).includes(bitId)) {
            console.log(`(mintBit) User does not own the bit.`);
            return {
                status: Status.ERROR,
                message: `(mintBit) User does not own the bit.`
            }
        }

        // get the bit data
        const bit = await BitModel.findOne({ bitId }).lean();

        if (!bit) {
            console.log(`(mintBit) Bit not found.`);
            return {
                status: Status.ERROR,
                message: `(mintBit) Bit not found.`
            }
        }

        // check if the bit is mintable
        if (!bit.blockchainData.mintable) {
            console.log(`(mintBit) Bit is not mintable.`);
            return {
                status: Status.ERROR,
                message: `(mintBit) Bit is not mintable.`
            }
        }

        // check if the bit is already minted
        if (bit.blockchainData.minted) {
            console.log(`(mintBit) Bit is already minted.`);
            return {
                status: Status.ERROR,
                message: `(mintBit) Bit is already minted.`
            }
        }

        // check if the bit is placed in an island
        if (bit.placedIslandId !== 0) {
            console.log(`(mintBit) Bit is placed in an island.`);
            return {
                status: Status.ERROR,
                message: `(mintBit) Bit is placed in an island.`
            }
        }

        // create the hash salt
        const salt = generateHashSalt();
        // create the op hash
        const opHash = generateOpHash(user.wallet?.address, salt);
        // create the admin's signature
        const signature = await DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER).signMessage(ethers.utils.arrayify(opHash));

        // estimate the gas required to mint the bit
        const gasEstimation = await WONDERBITS_CONTRACT.estimateGas.mint(
            user?.wallet?.address,
            [salt, signature]
        );
        // get the current gas price
        const gasPrice = await KAIA_TESTNET_PROVIDER.getGasPrice();

        // calculate the gas fee in KAIA
        const gasFee = ethers.utils.formatEther(gasEstimation.mul(gasPrice));

        // check if the user has enough KAIA to pay for the gas fee
        const userBalance = await KAIA_TESTNET_PROVIDER.getBalance(user.wallet?.address);
        const formattedUserBalance = ethers.utils.formatEther(userBalance);

        if (Number(formattedUserBalance) < Number(gasFee)) {
            console.log(`(mintBit) User does not have enough KAIA to pay for the gas fee.`);
            return {
                status: Status.ERROR,
                message: `(mintBit) User does not have enough KAIA to pay for the gas fee. Required: ${gasFee} KAIA --- User Balance: ${formattedUserBalance} KAIA`
            }
        }

        // get the user's private key
        const { encryptedPrivateKey } = user?.wallet as UserWallet;

        if (!encryptedPrivateKey) {
            return {
                status: Status.ERROR,
                message: `(mintBit) User's private key not found.`
            }
        }

        // decrypt the user's private key
        const decryptedPrivateKey = decryptPrivateKey(encryptedPrivateKey);

        // mint the bit
        const mintTx = await WONDERBITS_CONTRACT_USER(decryptedPrivateKey).mint(
            user.wallet?.address,
            [salt, signature],
            {
                gasLimit: gasEstimation
            }
        );

        // wait for the transaction to be mined
        const mintTxReceipt = await mintTx.wait();

        console.log(`(mintBit) Transaction mined: ${mintTxReceipt.transactionHash}`);

        // get the next token ID (for minting)
        // we will reduce 1 from the next token ID to get the token ID of the minted bit
        const nextTokenId = await WONDERBITS_CONTRACT.nextTokenId();

        // update the bit's blockchain data and owner data.
        // set the:
        // 1. `ownerData.currentOwnerAddress` and `ownerData.originalOwnerAddress` to the user's wallet address.
        // 2. `blockchainData.minted` to true
        // 3. `blockchainData.tokenId` to `nextTokenId - 1`
        // 4. `blockchainData.mintHash` to `mintHash`
        // 5. `blockchainData.chain` to (await KAIA_TESTNET_PROVIDER.getNetwork()).chainId
        // 6. `blockchainData.contractAddress` to `WONDERBITS_CONTRACT.address`
        // 7. `usable` to false
        const bitUpdateOperations = {
            $set: {
                'ownerData.currentOwnerAddress': user.wallet?.address,
                'ownerData.originalOwnerAddress': user.wallet?.address,
                'blockchainData.minted': true,
                'blockchainData.tokenId': nextTokenId - 1,
                'blockchainData.mintHash': mintTxReceipt.transactionHash,
                'blockchainData.chain': (await KAIA_TESTNET_PROVIDER.getNetwork()).chainId,
                'blockchainData.contractAddress': WONDERBITS_CONTRACT.address,
                'usable': false
            }
        }

        // execute the update operation
        await BitModel.updateOne({ bitId }, bitUpdateOperations);

        console.log(`(mintBit) Bit successfully minted.`);

        return {
            status: Status.SUCCESS,
            message: `(mintBit) Bit successfully minted.`,
            data: {
                bitId,
                tokenId: nextTokenId - 1,
                mintHash: mintTxReceipt.transactionHash,
                gasFee
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(mintBit) Error: ${err.message}`
        }
    }
}

/**
 * Mints an island into the KAIA blockchain for the user.
 */
export const mintIsland = async (twitterId: string, islandId: number): Promise<ReturnValue> => {
    try {
        // get the user's data
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(mintIsland) User not found.`
            }
        }

        // check if the user owns the island
        if (!(user.inventory?.islandIds as number[]).includes(islandId)) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(mintIsland) User does not own the island.`
            }
        }

        // get the island data
        const island = await IslandModel.findOne({ islandId }).lean();

        if (!island) {
            return {
                status: Status.ERROR,
                message: `(mintIsland) Island not found.`
            }
        }

        // check if the island is mintable
        if (!island.blockchainData.mintable) {
            return {
                status: Status.ERROR,
                message: `(mintIsland) Island is not mintable.`
            }
        }

        // check if the island is already minted
        if (island.blockchainData.minted) {
            return {
                status: Status.ERROR,
                message: `(mintIsland) Island is already minted.`
            }
        }

        // check if there are any placed bits on the island
        if (island.placedBitIds.length > 0) {
            return {
                status: Status.ERROR,
                message: `(mintIsland) Island has bits placed on it.`
            }
        }

        // create the hash salt
        const salt = generateHashSalt();
        // create the op hash
        const opHash = generateOpHash(user.wallet?.address, salt);
        // create the admin's signature
        const signature = await DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER).signMessage(ethers.utils.arrayify(opHash));

        // estimate the gas required to mint the island
        const gasEstimation = await ISLANDS_CONTRACT.estimateGas.mint(
            user?.wallet?.address,
            [salt, signature]
        );

        // get the current gas price
        const gasPrice = await KAIA_TESTNET_PROVIDER.getGasPrice();

        // calculate the gas fee in KAIA
        const gasFee = ethers.utils.formatEther(gasEstimation.mul(gasPrice));

        // check if the user has enough KAIA to pay for the gas fee
        const userBalance = await KAIA_TESTNET_PROVIDER.getBalance(user.wallet?.address);
        const formattedUserBalance = ethers.utils.formatEther(userBalance);

        if (Number(formattedUserBalance) < Number(gasFee)) {
            console.log(`(mintIsland) User does not have enough KAIA to pay for the gas fee.`);
            return {
                status: Status.ERROR,
                message: `(mintIsland) User does not have enough KAIA to pay for the gas fee. Required: ${gasFee} KAIA --- User Balance: ${formattedUserBalance} KAIA`
            }
        }

        // get the user's private key
        const { encryptedPrivateKey } = user?.wallet as UserWallet;

        if (!encryptedPrivateKey) {
            return {
                status: Status.ERROR,
                message: `(mintIsland) User's private key not found.`
            }
        }

        // decrypt the user's private key
        const decryptedPrivateKey = decryptPrivateKey(encryptedPrivateKey);

        // mint the island
        const mintTx = await ISLANDS_CONTRACT_USER(decryptedPrivateKey).mint(
            user.wallet?.address,
            [salt, signature],
            {
                gasLimit: gasEstimation
            }
        );

        // wait for the transaction to be mined
        const mintTxReceipt = await mintTx.wait();

        console.log(`(mintBit) Transaction mined: ${mintTxReceipt.transactionHash}`);

        // get the next token ID (for minting)
        // we will reduce 1 from the next token ID to get the token ID of the minted island
        const nextTokenId = await ISLANDS_CONTRACT.nextTokenId();

        // update the island's blockchain data and owner data.
        // set the:
        // 1. `ownerData.currentOwnerAddress` and `ownerData.originalOwnerAddress` to the user's wallet address.
        // 2. `blockchainData.minted` to true
        // 3. `blockchainData.tokenId` to `nextTokenId - 1`
        // 4. `blockchainData.mintHash` to `mintHash`
        // 5. `blockchainData.chain` to (await KAIA_TESTNET_PROVIDER.getNetwork()).chainId
        // 6. `blockchainData.contractAddress` to `ISLANDS_CONTRACT.address`
        // 7. `usable` to false
        const islandUpdateOperations = {
            $set: {
                'ownerData.currentOwnerAddress': user.wallet?.address,
                'ownerData.originalOwnerAddress': user.wallet?.address,
                'blockchainData.minted': true,
                'blockchainData.tokenId': nextTokenId - 1,
                'blockchainData.mintHash': mintTxReceipt.transactionHash,
                'blockchainData.chain': (await KAIA_TESTNET_PROVIDER.getNetwork()).chainId,
                'blockchainData.contractAddress': ISLANDS_CONTRACT.address,
                'usable': false
            }
        }

        // update the island
        await IslandModel.updateOne({ islandId }, islandUpdateOperations);

        console.log(`(mintIsland) Island minted successfully.`);

        return {
            status: Status.SUCCESS,
            message: `(mintIsland) Island minted successfully.`,
            data: {
                mintedIsland: {
                    islandId,
                    tokenId: nextTokenId - 1,
                    mintHash: mintTxReceipt.transactionHash,
                    gasFee
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(mintIsland) Error: ${err.message}`
        }
    }
}

/**
 * Mints a bit cosmetic into the KAIA blockchain for the user.
 */
export const mintBitCosmetic = async (twitterId: string, bitCosmeticId: number): Promise<ReturnValue> => {
    try {
        // get the user's data
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(mintIsland) User not found.`
            }
        }

        // check if the user owns the bit cosmetic.
        if (!(user.inventory?.bitCosmeticIds as number[]).includes(bitCosmeticId)) {
            return {
                status: Status.ERROR,
                message: `(mintBitCosmetic) User does not own bit cosmetic with ID: ${bitCosmeticId}`
            }
        }

        // get the bit cosmetic data
        const cosmetic = await UserBitCosmeticModel.findOne({ bitCosmeticId, ownerData: { currentOwnerId: user._id } }).lean();

        if (!cosmetic) {
            return {
                status: Status.ERROR,
                message: `(mintBitCosmetic) Bit cosmetic with ID: ${bitCosmeticId} not found`
            }
        }

        // check if the cosmetic is mintable
        if (!cosmetic.blockchainData.mintable) {
            return {
                status: Status.ERROR,
                message: `(mintBitCosmetic) Bit cosmetic with ID: ${bitCosmeticId} is not mintable`
            }
        }

        // check if the cosmetic is already minted
        if (cosmetic.blockchainData.minted) {
            return {
                status: Status.ERROR,
                message: `(mintBitCosmetic) Bit cosmetic with ID: ${bitCosmeticId} is already minted`
            }
        }

        // check if the cosmetic is being used
        if (cosmetic.equippedBitId !== 0) {
            return {
                status: Status.ERROR,
                message: `(mintBitCosmetic) Bit cosmetic with ID: ${bitCosmeticId} is being used on a bit`
            }
        }

        // create the hash salt
        const salt = generateHashSalt();
        // create the op hash
        const opHash = generateOpHash(user.wallet?.address, salt);
        // create the admin's signature
        const signature = await DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER).signMessage(ethers.utils.arrayify(opHash));

        // estimate the gas required to mint the cosmetic
        const gasEstimation = await BIT_COSMETICS_CONTRACT.estimateGas.mint(
            user?.wallet?.address,
            [salt, signature]
        );

        // get the current gas price
        const gasPrice = await KAIA_TESTNET_PROVIDER.getGasPrice();

        // calculate the gas fee in KAIA
        const gasFee = ethers.utils.formatEther(gasEstimation.mul(gasPrice));

        // check if the user has enough KAIA to pay for the gas fee
        const userBalance = await KAIA_TESTNET_PROVIDER.getBalance(user.wallet?.address);
        const formattedUserBalance = ethers.utils.formatEther(userBalance);

        if (Number(formattedUserBalance) < Number(gasFee)) {
            console.log(`(mintBitCosmetic) User does not have enough KAIA to pay for the gas fee.`);
            return {
                status: Status.ERROR,
                message: `(mintBitCosmetic) User does not have enough KAIA to pay for the gas fee. Required: ${gasFee} KAIA --- User Balance: ${formattedUserBalance} KAIA`
            }
        }

        // get the user's private key
        const { encryptedPrivateKey } = user?.wallet as UserWallet;

        if (!encryptedPrivateKey) {
            return {
                status: Status.ERROR,
                message: `(mintBitCosmetic) User's private key not found.`
            }
        }

        // decrypt the user's private key
        const decryptedPrivateKey = decryptPrivateKey(encryptedPrivateKey);

        // mint the cosmetic
        const mintTx = await BIT_COSMETICS_CONTRACT_USER(decryptedPrivateKey).mint(
            user.wallet?.address,
            [salt, signature],
            {
                gasLimit: gasEstimation
            }
        );

        // wait for the transaction to be mined
        const mintTxReceipt = await mintTx.wait();

        console.log(`(mintBitCosmetic) Transaction mined: ${mintTxReceipt.transactionHash}`);

        // get the next token ID (for minting)
        // we will reduce 1 from the next token ID to get the token ID of the minted island
        const nextTokenId = await BIT_COSMETICS_CONTRACT.nextTokenId();

        // update the cosmetic's blockchain data and owner data.
        // set the:
        // 1. `ownerData.currentOwnerAddress` and `ownerData.originalOwnerAddress` to the user's wallet address.
        // 2. `blockchainData.minted` to true
        // 3. `blockchainData.tokenId` to `nextTokenId - 1`
        // 4. `blockchainData.mintHash` to `mintHash`
        // 5. `blockchainData.chain` to (await KAIA_TESTNET_PROVIDER.getNetwork()).chainId
        // 6. `blockchainData.contractAddress` to `BIT_COSMETICS_CONTRACT.address`
        // 7. `usable` to false
        const bitCosmeticsUpdateOperations = {
            $set: {
                'ownerData.currentOwnerAddress': user.wallet?.address,
                'ownerData.originalOwnerAddress': user.wallet?.address,
                'blockchainData.minted': true,
                'blockchainData.tokenId': nextTokenId - 1,
                'blockchainData.mintHash': mintTxReceipt.transactionHash,
                'blockchainData.chain': (await KAIA_TESTNET_PROVIDER.getNetwork()).chainId,
                'blockchainData.contractAddress': BIT_COSMETICS_CONTRACT.address,
                'usable': false
            }
        }

        // update the cosmetic in the database
        await UserBitCosmeticModel.updateOne({ bitCosmeticId, ownerData: { currentOwnerId: user._id } }, bitCosmeticsUpdateOperations);

        console.log(`(mintBitCosmetic) Bit Cosmetic minted successfully.`);

        return {
            status: Status.SUCCESS,
            message: `(mintBitCosmetic) Bit Cosmetic minted successfully.`,
            data: {
                mintedCosmetic: {
                    bitCosmeticId,
                    tokenId: nextTokenId - 1,
                    mintHash: mintTxReceipt.transactionHash,
                    gasFee
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(mintBitCosmetic) Error: ${err.message}`
        }
    }
}


/**
 * Mints a specific amount of an in-game asset into an SFT in the KAIA blockchain for the user.
 */
export const mintSFT = async (twitterId: string, asset: AssetType, amount: number): Promise<ReturnValue> => {
    // check the WONDERBITS_SFT_IDS to see if the asset data is there
    const assetData = WONDERBITS_SFT_IDS.find(data => data.asset === asset);

    if (!assetData) {
        return {
            status: Status.ERROR,
            message: `(mintSFT) Asset data not found.`
        }
    }

    try {
        // get the user's data
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(mintSFT) User not found.`
            }
        }

        // check if the user has the asset
        const assetType = assetData.type;
        let assetIndex = -1;

        // create the update operations to deduct the `mintableAmount` and `amount` of the asset from the user's inventory
        const userUpdateOperations = {
            $inc: {}
        }

        if (assetType === 'resource') {
            // check the user's inventory for the resource
            assetIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(r => r.type === asset);

            if (assetIndex === -1) {
                return {
                    status: Status.ERROR,
                    message: `(mintSFT) User does not have the specified resource to mint.`
                }
            }

            // check if the user has enough `mintableAmount` of the resource
            // NOTE: `mintableAmount` is just a value to state the amount of the resource that can be minted into an SFT.
            // this doesn't mean that the user owns `mintableAmount` of the resource.
            // we will still need to check if the user has enough `amount` of the resource to mint.
            if ((user.inventory?.resources as ExtendedResource[])[assetIndex].mintableAmount < amount) {
                return {
                    status: Status.ERROR,
                    message: '(mintSFT) User doesn\'t have enough `mintableAmount` of the asset to mint.'
                }
            }

            // check if the user has enough `amount` of the resource
            if ((user.inventory?.resources as ExtendedResource[])[assetIndex].amount < amount) {
                return {
                    status: Status.ERROR,
                    message: `(mintSFT) User doesn't have enough of the asset to mint.`
                }
            }

            // deduct the `mintableAmount` and `amount` of the resource from the user's inventory
            userUpdateOperations.$inc[`inventory.resources.${assetIndex}.mintableAmount`] = -amount;
            userUpdateOperations.$inc[`inventory.resources.${assetIndex}.amount`] = -amount;
        } else if (assetType === 'item') {
            // check the user's inventory for the item
            assetIndex = (user.inventory?.items as Item[]).findIndex(i => i.type === asset);

            if (assetIndex === -1) {
                return {
                    status: Status.ERROR,
                    message: `(mintSFT) User does not have the specified item to mint.`
                }
            }

            // check if the user has enough `mintableAmount` of the item
            // NOTE: `mintableAmount` is just a value to state the amount of the item that can be minted into an SFT.
            // this doesn't mean that the user owns `mintableAmount` of the item.
            // we will still need to check if the user has enough `amount` of the item to mint.
            if ((user.inventory?.items as Item[])[assetIndex].mintableAmount < amount) {
                return {
                    status: Status.ERROR,
                    message: '(mintSFT) User doesn\'t have enough `mintableAmount` of the asset to mint.'
                }
            }

            // check if the user has enough `amount` of the item
            if ((user.inventory?.items as Item[])[assetIndex].amount < amount) {
                return {
                    status: Status.ERROR,
                    message: `(mintSFT) User doesn't have enough of the asset to mint.`
                }
            }

            // deduct the `mintableAmount` and `amount` of the item from the user's inventory
            userUpdateOperations.$inc[`inventory.items.${assetIndex}.mintableAmount`] = -amount;
            userUpdateOperations.$inc[`inventory.items.${assetIndex}.amount`]
        } else if (assetType === 'food') {
            // check the user's inventory for the food
            assetIndex = (user.inventory?.foods as Food[]).findIndex(f => f.type === asset);

            if (assetIndex === -1) {
                return {
                    status: Status.ERROR,
                    message: `(mintSFT) User does not have the specified food to mint.`
                }
            }

            // check if the user has enough `mintableAmount` of the food
            // NOTE: `mintableAmount` is just a value to state the amount of the food that can be minted into an SFT.
            // this doesn't mean that the user owns `mintableAmount` of the food.
            // we will still need to check if the user has enough `amount` of the food to mint.
            if ((user.inventory?.foods as Food[])[assetIndex].mintableAmount < amount) {
                return {
                    status: Status.ERROR,
                    message: '(mintSFT) User doesn\'t have enough `mintableAmount` of the asset to mint.'
                }
            }

            // check if the user has enough `amount` of the food
            if ((user.inventory?.foods as Food[])[assetIndex].amount < amount) {
                return {
                    status: Status.ERROR,
                    message: `(mintSFT) User doesn't have enough of the asset to mint.`
                }
            }

            // deduct the `mintableAmount` and `amount` of the food from the user's inventory
            userUpdateOperations.$inc[`inventory.foods.${assetIndex}.mintableAmount`] = -amount;
            userUpdateOperations.$inc[`inventory.foods.${assetIndex}.amount`] = -amount;
        } else {
            return {
                status: Status.ERROR,
                message: `(mintSFT) Asset type not found.`
            }
        }

        // create the hash salt
        const salt = generateHashSalt();
        // create the op hash
        const opHash = generateOpHash(user.wallet?.address, salt);
        // create the admin's signature
        const signature = await DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER).signMessage(ethers.utils.arrayify(opHash));

        // estimate the gas required to mint the SFT
        const gasEstimation = await WONDERBITS_SFT_CONTRACT.estimateGas.mint(
            user?.wallet?.address,
            assetData.id,
            amount,
            '0x',
            [salt, signature]
        );

        // get the current gas price
        const gasPrice = await KAIA_TESTNET_PROVIDER.getGasPrice();

        // calculate the gas fee in KAIA
        const gasFee = ethers.utils.formatEther(gasEstimation.mul(gasPrice));

        // check if the user has enough KAIA to pay for the gas fee
        const userBalance = await KAIA_TESTNET_PROVIDER.getBalance(user.wallet?.address);
        const formattedUserBalance = ethers.utils.formatEther(userBalance);

        if (Number(formattedUserBalance) < Number(gasFee)) {
            console.log(`(mintSFT) User does not have enough KAIA to pay for the gas fee.`);
            return {
                status: Status.ERROR,
                message: `(mintSFT) User does not have enough KAIA to pay for the gas fee. Required: ${gasFee} KAIA --- User Balance: ${formattedUserBalance} KAIA`
            }
        }

        // get the user's private key
        const { encryptedPrivateKey } = user?.wallet as UserWallet;

        if (!encryptedPrivateKey) {
            return {
                status: Status.ERROR,
                message: `(mintSFT) User's private key not found.`
            }
        }

        // decrypt the user's private key
        const decryptedPrivateKey = decryptPrivateKey(encryptedPrivateKey);

        // mint the SFT
        const mintTx = await WONDERBITS_SFT_CONTRACT_USER(decryptedPrivateKey).mint(
            user.wallet?.address,
            assetData.id,
            amount,
            '0x',
            [salt, signature],
            {
                gasLimit: gasEstimation
            }
        );

        // wait for the transaction to be mined
        const mintTxReceipt = await mintTx.wait();

        console.log(`(mintSFT) Transaction mined: ${mintTxReceipt.transactionHash}`);

        // do the update operations
        await UserModel.updateOne({ twitterId }, userUpdateOperations);

        console.log(`(mintSFT) SFT successfully minted.`);

        return {
            status: Status.SUCCESS,
            message: `(mintSFT) SFT successfully minted.`,
            data: {
                asset,
                amount,
                mintHash: mintTxReceipt.transactionHash,
                gasFee
            }
        }
    } catch (err: any) {
        console.error(`(mintSFT) ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(mintSFT) ${err.message}`
        }
    }
}

/**
 * Stores a minted bit, island or bit cosmetic in the custodial contract to allow it to be used in-game (i.e. for `usable` to be true).
 */
export const storeInCustody = async (twitterId: string, asset: 'bit' | 'island' | 'bitCosmetic', assetId: number): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(storeInCustody) User not found.`
            }
        }

        // check if the user owns the asset on the database-level (contract will then also check if the user owns it on the blockchain-level)
        const assetData = 
            asset === 'bit' ? await BitModel.findOne({ bitId: assetId, 'ownerData.currentOwnerAddress': user.wallet?.address }).lean() :
            asset === 'island' ? await IslandModel.findOne({ islandId: assetId, 'ownerData.currentOwnerAddress': user.wallet?.address }).lean() :
            asset === 'bitCosmetic' ? await UserBitCosmeticModel.findOne({ bitCosmeticId: assetId, 'ownerData.currentOwnerAddress': user.wallet?.address }).lean() :
            null;

        if (!assetData || assetData.ownerData.currentOwnerId !== user._id) {
            return {
                status: Status.ERROR,
                message: `(storeInCustody) User does not own the asset.`
            }
        }

        // create the hash salt
        const salt = generateHashSalt();
        // create the op hash
        const opHash = generateOpHash(user.wallet?.address, salt);
        // create the admin's signature
        const signature = await DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER).signMessage(ethers.utils.arrayify(opHash));

        const nftContractAddress = 
            asset === 'bit' ? WONDERBITS_CONTRACT.address :
            asset === 'island' ? ISLANDS_CONTRACT.address :
            asset === 'bitCosmetic' ? BIT_COSMETICS_CONTRACT.address :
            null;

        if (!nftContractAddress) {
            return {
                status: Status.ERROR,
                message: `(storeInCustody) NFT contract address not found.`
            }
        }

        // estimate the gas required to store the asset in custody
        const gasEstimation = await CUSTODIAL_CONTRACT.estimateGas.storeInCustody(
            nftContractAddress,
            assetData.blockchainData?.tokenId,
            [salt, signature]
        );

        // get the current gas price
        const gasPrice = await KAIA_TESTNET_PROVIDER.getGasPrice();

        // calculate the gas fee in KAIA
        const gasFee = ethers.utils.formatEther(gasEstimation.mul(gasPrice));

        // check if the user has enough KAIA to pay for the gas fee
        const userBalance = await KAIA_TESTNET_PROVIDER.getBalance(user.wallet?.address);
        const formattedUserBalance = ethers.utils.formatEther(userBalance);

        if (Number(formattedUserBalance) < Number(gasFee)) {
            console.log(`(storeInCustody) User does not have enough KAIA to pay for the gas fee.`);
            return {
                status: Status.ERROR,
                message: `(storeInCustody) User does not have enough KAIA to pay for the gas fee. Required: ${gasFee} KAIA --- User Balance: ${formattedUserBalance} KAIA`
            }
        }

        // get the user's private key
        const { encryptedPrivateKey } = user?.wallet as UserWallet;

        if (!encryptedPrivateKey) {
            return {
                status: Status.ERROR,
                message: `(storeInCustody) User's private key not found.`
            }
        }

        // decrypt the user's private key
        const decryptedPrivateKey = decryptPrivateKey(encryptedPrivateKey);

        // store the asset in custody
        const storeTx = await CUSTODIAL_CONTRACT_USER(decryptedPrivateKey).storeInCustody(
            nftContractAddress,
            assetData.blockchainData?.tokenId,
            [salt, signature],
            {
                gasLimit: gasEstimation
            }
        );

        // wait for the transaction to be mined
        const storeTxReceipt = await storeTx.wait();

        console.log(`(storeInCustody) Transaction mined: ${storeTxReceipt.transactionHash}`);

        // update the `usable` field of the asset to true
        if (asset === 'bit') {
            await BitModel.updateOne({ bitId: assetId }, {
                $set: {
                    usable: true,
                    'ownerData.inCustody': true
                }
            });
        } else if (asset === 'island') {
            await IslandModel.updateOne({ islandId: assetId }, {
                $set: {
                    usable: true,
                    'ownerData.inCustody': true
                }
            });
        } else if (asset === 'bitCosmetic') {
            await UserBitCosmeticModel.updateOne({ bitCosmeticId: assetId }, {
                $set: {
                    usable: true,
                    'ownerData.inCustody': true
                }
            });
        }

        console.log(`(storeInCustody) Asset stored in custody successfully.`);

        return {
            status: Status.SUCCESS,
            message: `(storeInCustody) Asset stored in custody successfully.`,
            data: {
                asset,
                assetId,
                storeHash: storeTxReceipt.transactionHash,
                gasFee
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(storeInCustody) ${err.message}`
        }
    }
}

/**
 * Releases a minted bit, island or bit cosmetic out of custody from the custodial contract, transferring it back to the user's wallet.
 */
export const releaseFromCustody = async (twitterId: string, asset: 'bit' | 'island' | 'bitCosmetic', assetId: number): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(releaseFromCustody) User not found.`
            }
        }

        // check if the user owns the asset on the database-level (contract will then also check if the user owns it on the blockchain-level)
        const assetData = 
            asset === 'bit' ? await BitModel.findOne({ bitId: assetId, 'ownerData.currentOwnerAddress': user.wallet?.address }).lean() :
            asset === 'island' ? await IslandModel.findOne({ islandId: assetId, 'ownerData.currentOwnerAddress': user.wallet?.address }).lean() :
            asset === 'bitCosmetic' ? await UserBitCosmeticModel.findOne({ bitCosmeticId: assetId, 'ownerData.currentOwnerAddress': user.wallet?.address }).lean() :
            null;

        if (!assetData || assetData.ownerData.currentOwnerId !== user._id) {
            return {
                status: Status.ERROR,
                message: `(releaseFromCustody) User does not own the asset.`
            }
        }

        // check if the asset is in custody (from the database level)
        if (!assetData.ownerData.inCustody) {
            return {
                status: Status.ERROR,
                message: `(releaseFromCustody) Asset is not in custody.`
            }
        }

        // create the hash salt
        const salt = generateHashSalt();
        // create the op hash
        const opHash = generateOpHash(user.wallet?.address, salt);
        // create the admin's signature
        const signature = await DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER).signMessage(ethers.utils.arrayify(opHash));

        const nftContractAddress = 
            asset === 'bit' ? WONDERBITS_CONTRACT.address :
            asset === 'island' ? ISLANDS_CONTRACT.address :
            asset === 'bitCosmetic' ? BIT_COSMETICS_CONTRACT.address :
            null;

        if (!nftContractAddress) {
            return {
                status: Status.ERROR,
                message: `(releaseFromCustody) NFT contract address not found.`
            }
        }

        // estimate the gas required to release the asset from custody
        const gasEstimation = await CUSTODIAL_CONTRACT.estimateGas.releaseFromCustody(
            nftContractAddress,
            assetData.blockchainData?.tokenId,
            [salt, signature]
        );

        // get the current gas price
        const gasPrice = await KAIA_TESTNET_PROVIDER.getGasPrice();

        // calculate the gas fee in KAIA
        const gasFee = ethers.utils.formatEther(gasEstimation.mul(gasPrice));

        // check if the user has enough KAIA to pay for the gas fee
        const userBalance = await KAIA_TESTNET_PROVIDER.getBalance(user.wallet?.address);
        const formattedUserBalance = ethers.utils.formatEther(userBalance);

        if (Number(formattedUserBalance) < Number(gasFee)) {
            console.log(`(releaseFromCustody) User does not have enough KAIA to pay for the gas fee.`);
            return {
                status: Status.ERROR,
                message: `(releaseFromCustody) User does not have enough KAIA to pay for the gas fee. Required: ${gasFee} KAIA --- User Balance: ${formattedUserBalance} KAIA`
            }
        }

        // get the user's private key
        const { encryptedPrivateKey } = user?.wallet as UserWallet;

        if (!encryptedPrivateKey) {
            return {
                status: Status.ERROR,
                message: `(releaseFromCustody) User's private key not found.`
            }
        }

        // decrypt the user's private key
        const decryptedPrivateKey = decryptPrivateKey(encryptedPrivateKey);

        // release the asset from custody
        const releaseTx = await CUSTODIAL_CONTRACT_USER(decryptedPrivateKey).releaseFromCustody(
            nftContractAddress,
            assetData.blockchainData?.tokenId,
            [salt, signature],
            {
                gasLimit: gasEstimation
            }
        );

        // wait for the transaction to be mined
        const releaseTxReceipt = await releaseTx.wait();

        console.log(`(releaseFromCustody) Transaction mined: ${releaseTxReceipt.transactionHash}`);

        // update the `usable` field of the asset to false
        if (asset === 'bit') {
            await BitModel.updateOne({ bitId: assetId }, {
                $set: {
                    usable: false,
                    'ownerData.inCustody': false
                }
            });
        } else if (asset === 'island') {
            await IslandModel.updateOne({ islandId: assetId }, {
                $set: {
                    usable: false,
                    'ownerData.inCustody': false
                }
            });
        } else if (asset === 'bitCosmetic') {
            await UserBitCosmeticModel.updateOne({ bitCosmeticId: assetId }, {
                $set: {
                    usable: false,
                    'ownerData.inCustody': false
                }
            });
        }

        console.log(`(releaseFromCustody) Asset released from custody successfully.`);

        return {
            status: Status.SUCCESS,
            message: `(releaseFromCustody) Asset released from custody successfully.`,
            data: {
                asset,
                assetId,
                releaseHash: releaseTxReceipt.transactionHash,
                gasFee
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(releaseFromCustody) ${err.message}`
        }
    }
}

/**
 * For any NFTs (bit cosmetics, islands, bits, etc.) that we not synced properly (e.g. user purchased the NFT but they didn't make their account yet),
 * this function will manually help them sync their inventory, updating the owner data of the NFTs to their current account if applicable.
 * 
 * NOTE: to save API costs, this will only fetch the user's MAIN WALLET. any NFTs stored in secondary wallets that were not synced properly will NOT be updatable via this function.
 */
export const syncInventoryWithNFT = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(syncInventoryWithNFT) User not found.`
            }
        }

        // fetch the user's main address
        const mainWallet = user?.wallet as UserWallet;

        // for each NFT (bit cosmetic, island, bit), fetch the user's owned token IDs
        const rawBitTokenIds = await WONDERBITS_CONTRACT.tokensOfOwner(mainWallet.address);
        const rawIslandTokenIds = await ISLANDS_CONTRACT.tokensOfOwner(mainWallet.address);
        const rawBitCosmeticTokenIds = await BIT_COSMETICS_CONTRACT.tokensOfOwner(mainWallet.address);

        // converted to string just in case of very large numbers in the future
        const blockchainBitTokenIds: string[] = rawBitTokenIds.map((id: ethers.BigNumber) => id.toString());
        const blockchainIslandTokenIds: string[] = rawIslandTokenIds.map((id: ethers.BigNumber) => id.toString());
        const blockchainBitCosmeticTokenIds: string[] = rawBitCosmeticTokenIds.map((id: ethers.BigNumber) => id.toString());

        const bits = await BitModel.find({ 'ownerData.currentOwnerId': user._id }).lean();
        const islands = await IslandModel.find({ 'ownerData.currentOwnerId': user._id }).lean();
        const bitCosmetics = await UserBitCosmeticModel.find({ 'ownerData.currentOwnerId': user._id }).lean();

        // fetch the owned token ids for each nft that are already inputted in the database
        // filter out the ones with `null` because those haven't been minted yet
        // note: at the end, all token ids will be converted to string because the token ids obtained from the contract (above) are all strings.
        const dbBitTokenIds = bits.map(bit => bit.blockchainData.tokenId).filter(id => id !== null).map(id => id.toString())
        const dbIslandTokenIds = islands.map(island => island.blockchainData.tokenId).filter(id => id !== null).map(id => id.toString());
        const dbBitCosmeticTokenIds = bitCosmetics.map(cosmetic => cosmetic.blockchainData.tokenId).filter(id => id !== null).map(id => id.toString());

        // for each of the bits, islands and bit cosmetic token ids, check if the owner data properly points to this user.
        // any that aren't will be updated.
        // we will divide them into two arrays each, one for ids no longer owned by this user, and one for ids that need to be updated to point to this user.
        const bitTokenIdsToUpdate = blockchainBitTokenIds.filter(id => !dbBitTokenIds.includes(id));
        const notOwnedBitTokenIds = dbBitTokenIds.filter(id => !blockchainBitTokenIds.includes(id));

        const islandTokenIdsToUpdate = blockchainIslandTokenIds.filter(id => !dbIslandTokenIds.includes(id));
        const notOwnedIslandTokenIds = dbIslandTokenIds.filter(id => !blockchainIslandTokenIds.includes(id));

        const bitCosmeticTokenIdsToUpdate = blockchainBitCosmeticTokenIds.filter(id => !dbBitCosmeticTokenIds.includes(id));
        const notOwnedBitCosmeticTokenIds = dbBitCosmeticTokenIds.filter(id => !blockchainBitCosmeticTokenIds.includes(id));

        console.log(`(syncInventoryWithNFT) notOwnedBitTokenIds: ${notOwnedBitTokenIds}`);
        console.log(`(syncInventoryWithNFT) bitTokenIdsToUpdate: ${bitTokenIdsToUpdate}`);
        console.log(`(syncInventoryWithNFT) notOwnedIslandTokenIds: ${notOwnedIslandTokenIds}`);
        console.log(`(syncInventoryWithNFT) islandTokenIdsToUpdate: ${islandTokenIdsToUpdate}`);
        console.log(`(syncInventoryWithNFT) notOwnedBitCosmeticTokenIds: ${notOwnedBitCosmeticTokenIds}`);
        console.log(`(syncInventoryWithNFT) bitCosmeticTokenIdsToUpdate: ${bitCosmeticTokenIdsToUpdate}`);
    
        // for token ids that are no longer owned, we will update the owner data's user id to null and owner address also to null.
        // rather than trying to fetch the owner of every single id within all the `notOwned...` arrays, we want to save time and API costs.
        // therefore, the user of those IDs will then have to manually call this function in order for it to be synced with their inventory,
        // converting those data instances from null to their actual owner data.
        const bitUpdateOperations: Array<{
            bitId: number;
            updateOperations: {
                $set: {}
            }
        }> = [];

        const islandUpdateOperations: Array<{
            islandId: number;
            updateOperations: {
                $set: {}
            }
        }> = [];

        const bitCosmeticUpdateOperations: Array<{
            bitCosmeticId: number;
            updateOperations: {
                $set: {}
            }
        }> = [];

        if (notOwnedBitTokenIds.length > 0) {
            for (const notOwnedBitTokenId of notOwnedBitTokenIds) {
                const bit = bits.find(bit => bit.blockchainData.tokenId === parseInt(notOwnedBitTokenId));
    
                if (bit) {
                    bitUpdateOperations.push({
                        bitId: bit.bitId,
                        updateOperations: {
                            $set: {
                                'ownerData.currentOwnerId': null,
                                'ownerData.currentOwnerAddress': null
                            }
                        }
                    });
                }
            }
        }

        if (notOwnedIslandTokenIds.length > 0) {
            for (const notOwnedIslandTokenId of notOwnedIslandTokenIds) {
                const island = islands.find(island => island.blockchainData.tokenId === parseInt(notOwnedIslandTokenId));
    
                if (island) {
                    islandUpdateOperations.push({
                        islandId: island.islandId,
                        updateOperations: {
                            $set: {
                                'ownerData.currentOwnerId': null,
                                'ownerData.currentOwnerAddress': null
                            }
                        }
                    });
                }
            }
        }

        if (notOwnedBitCosmeticTokenIds.length > 0) {
            for (const notOwnedBitCosmeticTokenId of notOwnedBitCosmeticTokenIds) {
                const bitCosmetic = bitCosmetics.find(cosmetic => cosmetic.blockchainData.tokenId === parseInt(notOwnedBitCosmeticTokenId));
    
                if (bitCosmetic) {
                    bitCosmeticUpdateOperations.push({
                        bitCosmeticId: bitCosmetic.bitCosmeticId,
                        updateOperations: {
                            $set: {
                                'ownerData.currentOwnerId': null,
                                'ownerData.currentOwnerAddress': null
                            }
                        }
                    });
                }
            }
        }

        // for token ids that need to be updated, we will update the owner data's user id to this user's id and owner address to this user's wallet address.
        // this will allow the user to properly see their NFTs in their inventory.
        if (bitTokenIdsToUpdate.length > 0) {
            for (const bitTokenIdToUpdate of bitTokenIdsToUpdate) {
                const bit = bits.find(bit => bit.blockchainData.tokenId === parseInt(bitTokenIdToUpdate));
    
                if (bit) {
                    bitUpdateOperations.push({
                        bitId: bit.bitId,
                        updateOperations: {
                            $set: {
                                'ownerData.currentOwnerId': user._id,
                                'ownerData.currentOwnerAddress': mainWallet.address
                            }
                        }
                    });
                }
            }
        }

        if (islandTokenIdsToUpdate.length > 0) {
            for (const islandTokenIdToUpdate of islandTokenIdsToUpdate) {
                const island = islands.find(island => island.blockchainData.tokenId === parseInt(islandTokenIdToUpdate));
    
                if (island) {
                    islandUpdateOperations.push({
                        islandId: island.islandId,
                        updateOperations: {
                            $set: {
                                'ownerData.currentOwnerId': user._id,
                                'ownerData.currentOwnerAddress': mainWallet.address
                            }
                        }
                    });
                }
            }
        }

        if (bitCosmeticTokenIdsToUpdate.length > 0) {
            for (const bitCosmeticTokenIdToUpdate of bitCosmeticTokenIdsToUpdate) {
                const bitCosmetic = bitCosmetics.find(cosmetic => cosmetic.blockchainData.tokenId === parseInt(bitCosmeticTokenIdToUpdate));
    
                if (bitCosmetic) {
                    bitCosmeticUpdateOperations.push({
                        bitCosmeticId: bitCosmetic.bitCosmeticId,
                        updateOperations: {
                            $set: {
                                'ownerData.currentOwnerId': user._id,
                                'ownerData.currentOwnerAddress': mainWallet.address
                            }
                        }
                    });
                }
            }
        }

        console.log(`(syncInventoryWithNFT) bitUpdateOperations: ${JSON.stringify(bitUpdateOperations)}`);
        console.log(`(syncInventoryWithNFT) islandUpdateOperations: ${JSON.stringify(islandUpdateOperations)}`);
        console.log(`(syncInventoryWithNFT) bitCosmeticUpdateOperations: ${JSON.stringify(bitCosmeticUpdateOperations)}`);
        
        // execute the update operations
        const bitUpdatePromises = bitUpdateOperations.length > 0 ? bitUpdateOperations.map(async op => {
            return BitModel.updateOne({ bitId: op.bitId }, op.updateOperations);
        }) : [];
        const islandUpdatePromises = islandUpdateOperations.length > 0 ? islandUpdateOperations.map(async op => {
            return IslandModel.updateOne({ islandId: op.islandId }, op.updateOperations);
        }) : [];
        const bitCosmeticUpdatePromises = bitCosmeticUpdateOperations.length > 0 ? bitCosmeticUpdateOperations.map(async op => {
            return UserBitCosmeticModel.updateOne({ bitCosmeticId: op.bitCosmeticId }, op.updateOperations);
        }) : [];

        await Promise.all([...bitUpdatePromises, ...islandUpdatePromises, ...bitCosmeticUpdatePromises]);

        console.log(`(syncInventoryWithNFT) Inventory synced successfully.`);

        return {
            status: Status.SUCCESS,
            message: `(syncInventoryWithNFT) Inventory synced successfully.`,
            data: {
                newIdsAdded: {
                    bitIds: bitTokenIdsToUpdate,
                    islandIds: islandTokenIdsToUpdate,
                    bitCosmeticIds: bitCosmeticTokenIdsToUpdate
                },
                oldIdsRemoved: {
                    bitIds: notOwnedBitTokenIds,
                    islandIds: notOwnedIslandTokenIds,
                    bitCosmeticIds: notOwnedBitCosmeticTokenIds
                }
            }
        }
    } catch (err: any) {
        console.log(`(syncInventoryWithNFT) ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(syncInventoryWithNFT) ${err.message}`
        }
    }
}

/**
 * Fetch the user's owned SFTs (from their main wallet only) 
 * from the blockchain (SFTs available to be fetched are based on `WONDERBITS_SFT_IDS`).
 */
export const fetchOwnedSFTs = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(fetchOwnedSFTs) User not found.`
            }
        }

        const ids = WONDERBITS_SFT_IDS.map(data => data.id);
        // create an array of addresses with the same length as `ids` pointing to `user.wallet.address`.
        // this is a requirement from ERC1155's `balanceOfBatch`.
        const addresses = Array(ids.length).fill(user?.wallet?.address);

        // batch fetch the user's owned SFTs
        const batchFetch = await WONDERBITS_SFT_CONTRACT.balanceOfBatch(
            addresses,
            ids
        );

        console.log(`(fetchOwnedSFTs) batchFetch: ${batchFetch}`);
    } catch (err: any) {
        console.log(`(fetchOwnedSFTs) ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(fetchOwnedSFTs) ${err.message}`
        }
    }
}

/**
 * Deposits `amount` of an SFT in-game, burning the equivalent amount of SFT in the blockchain.
 */
export const depositSFT = async (twitterId: string, sftId: number, amount: number): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(depositSFT) User not found.`
            }
        }

        // check if the user owns `amount` of `sftId`
        const balance = await WONDERBITS_SFT_CONTRACT.balanceOf(user?.wallet.address, sftId);

        if (balance < amount) {
            console.log(`(depositSFT) User does not have enough of the SFT to deposit.`);
            return {
                status: Status.ERROR,
                message: `(depositSFT) User does not have enough of the SFT to deposit.`
            }
        }

        // check which asset the SFT corresponds to
        const sftData = WONDERBITS_SFT_IDS.find(data => data.id === sftId);

        if (!sftData) {
            return {
                status: Status.ERROR,
                message: `(depositSFT) SFT data not found.`
            }
        }

        // estimate the gas required to burn the SFT
        const gasEstimation = await WONDERBITS_SFT_CONTRACT.estimateGas.burn(
            sftId,
            amount
        );

        // get the current gas price
        const gasPrice = await KAIA_TESTNET_PROVIDER.getGasPrice();

        // calculate the gas fee in KAIA
        const gasFee = ethers.utils.formatEther(gasEstimation.mul(gasPrice));

        // check if the user has enough KAIA to pay for the gas fee
        const userBalance = await KAIA_TESTNET_PROVIDER.getBalance(user.wallet?.address);
        const formattedUserBalance = ethers.utils.formatEther(userBalance);

        if (Number(formattedUserBalance) < Number(gasFee)) {
            console.log(`(depositSFT) User does not have enough KAIA to pay for the gas fee.`);
            return {
                status: Status.ERROR,
                message: `(depositSFT) User does not have enough KAIA to pay for the gas fee. Required: ${gasFee} KAIA --- User Balance: ${formattedUserBalance} KAIA`
            }
        }

        // get the user's private key
        const { encryptedPrivateKey } = user?.wallet as UserWallet;

        if (!encryptedPrivateKey) {
            return {
                status: Status.ERROR,
                message: `(depositSFT) User's private key not found.`
            }
        }

        // decrypt the user's private key
        const decryptedPrivateKey = decryptPrivateKey(encryptedPrivateKey);

        // call `burn` on the contract
        const burnTx = await WONDERBITS_SFT_CONTRACT_USER(decryptedPrivateKey).burn(
            sftId,
            amount,
            {
                gasLimit: gasEstimation
            }
        );

        // wait for the transaction to be mined
        const burnTxReceipt = await burnTx.wait();

        console.log(`(depositSFT) Burn transaction mined: ${burnTx.hash}`);

        // update the user's inventory
        const userUpdateOperations = {
            $push: {},
            $inc: {}
        }

        // check which asset's amount should be incremented based on the asset type
        if (sftData.type === 'food') {
            // check if the user already owns the food instance
            const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex(food => food.type === sftData.asset);

            if (existingFoodIndex !== -1) {
                userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = amount;
            } else {
                userUpdateOperations.$push = {
                    'inventory.foods': {
                        type: sftData.asset,
                        amount,
                        mintableAmount: amount,
                    }
                }
            }
        } else if (sftData.type === 'resource') {
            // check if the user already owns the resource instance
            const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex(resource => resource.type === sftData.asset);

            // get the full resource based on the sft data
            const resource: Resource = resources.find(resource => resource.type === sftData.asset);

            if (existingResourceIndex !== -1) {
                userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = amount;
            } else {
                userUpdateOperations.$push = {
                    'inventory.resources': {
                        ...resource,
                        amount,
                        origin: ExtendedResourceOrigin.NORMAL,
                        mintableAmount: amount,
                    }
                }
            }
        } else if (sftData.type === 'item') {
            // check if the user already owns the item instance
            const existingItemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === sftData.asset);

            if (existingItemIndex !== -1) {
                userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = amount;
            } else {
                userUpdateOperations.$push = {
                    'inventory.items': {
                        type: sftData.asset,
                        amount,
                        totalAmountConsumed: 0,
                        weeklyAmountConsumed: 0,
                        mintableAmount: amount,
                    }
                }
            }
        }

        // divide into push and inc separately to prevent conflicts
        await UserModel.updateOne({ twitterId }, {
            $push: userUpdateOperations.$push
        });

        await UserModel.updateOne({ twitterId }, {
            $inc: userUpdateOperations.$inc
        });

        return {
            status: Status.SUCCESS,
            message: `(depositSFT) SFT deposited succesfully in-game.`,
            data: {
                sftData,
                gasFee
            }
        }
    } catch (err: any) {
        console.log(`(depositSFT) ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(depositSFT) ${err.message}`
        }
    }
}

// depositSFT('1462755469102137357', 1, 1);
