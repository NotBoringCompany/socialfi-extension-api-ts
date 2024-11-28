import axios from 'axios';
import { ReturnValue, Status } from '../utils/retVal';
import { BitModel, IslandModel, ShopAssetPurchaseModel, UserBitCosmeticModel, UserModel } from '../utils/constants/db';
import { ExtendedXCookieData, UserWallet, XCookieSource } from '../models/user';
import { getUserCurrentPoints } from './leaderboard';
import { BINANCE_API_BASE_URL, BIT_COSMETICS_CONTRACT, DEPLOYER_WALLET, GATEIO_API_BASE_URL, ISLANDS_CONTRACT, KAIA_TESTNET_PROVIDER, KUCOIN_API_BASE_URL, TON_RECEIVER_ADDRESS, TON_WEB, WONDERBITS_CONTRACT, XPROTOCOL_TESTNET_PROVIDER } from '../utils/constants/web3';
import { ethers } from 'ethers';
import { TxParsedMessage } from '../models/web3';
import { ShopAssetPurchaseConfirmationAttemptType } from '../models/shop';
import { Item } from '../models/item';
import { Food } from '../models/food';
import { AssetType } from '../models/asset';
import { generateHashSalt, generateOpHash } from '../utils/crypto';

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

        // mint the bit
        const mintTx = await WONDERBITS_CONTRACT.mint(
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
        const bitUpdateOperations = {
            $set: {
                'ownerData.currentOwnerAddress': user.wallet?.address,
                'ownerData.originalOwnerAddress': user.wallet?.address,
                'blockchainData.minted': true,
                'blockchainData.tokenId': nextTokenId - 1,
                'blockchainData.mintHash': mintTxReceipt.transactionHash,
                'blockchainData.chain': (await KAIA_TESTNET_PROVIDER.getNetwork()).chainId,
                'blockchainData.contractAddress': WONDERBITS_CONTRACT.address
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

        // mint the island
        const mintTx = await ISLANDS_CONTRACT.mint(
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
        const islandUpdateOperations = {
            $set: {
                'ownerData.currentOwnerAddress': user.wallet?.address,
                'ownerData.originalOwnerAddress': user.wallet?.address,
                'blockchainData.minted': true,
                'blockchainData.tokenId': nextTokenId - 1,
                'blockchainData.mintHash': mintTxReceipt.transactionHash,
                'blockchainData.chain': (await KAIA_TESTNET_PROVIDER.getNetwork()).chainId,
                'blockchainData.contractAddress': ISLANDS_CONTRACT.address
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

        // mint the cosmetic
        const mintTx = await BIT_COSMETICS_CONTRACT.mint(
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
        const bitCosmeticsUpdateOperations = {
            $set: {
                'ownerData.currentOwnerAddress': user.wallet?.address,
                'ownerData.originalOwnerAddress': user.wallet?.address,
                'blockchainData.minted': true,
                'blockchainData.tokenId': nextTokenId - 1,
                'blockchainData.mintHash': mintTxReceipt.transactionHash,
                'blockchainData.chain': (await KAIA_TESTNET_PROVIDER.getNetwork()).chainId,
                'blockchainData.contractAddress': BIT_COSMETICS_CONTRACT.address
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
 * Mints an in-game asset into an SFT in the KAIA blockchain for the user.
 */
export const mintSFT = async (twitterId: string, asset: AssetType, amount: number): Promise<ReturnValue> => {
    try {

    } catch (err: any) {
        console.error(`(mintSFT) ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(mintSFT) ${err.message}`
        }
    }
}