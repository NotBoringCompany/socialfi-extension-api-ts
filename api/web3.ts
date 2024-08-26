import axios from 'axios';
import { ReturnValue, Status } from '../utils/retVal';
import { ShopAssetPurchaseModel, UserModel } from '../utils/constants/db';
import { ExtendedXCookieData, UserWallet, XCookieSource } from '../models/user';
import { getUserCurrentPoints } from './leaderboard';
import { generateHashSalt, generateWonderbitsDataHash } from '../utils/crypto';
import { BINANCE_API_BASE_URL, DEPLOYER_WALLET, GATEIO_API_BASE_URL, KUCOIN_API_BASE_URL, TON_RECEIVER_ADDRESS, TON_WEB, WONDERBITS_CONTRACT, XPROTOCOL_TESTNET_PROVIDER } from '../utils/constants/web3';
import { ethers } from 'ethers';
import { TxParsedMessage } from '../models/web3';
import { ShopAssetPurchaseConfirmationAttemptType } from '../models/shop';
import { Item } from '../models/item';
import { Food } from '../models/food';

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

        console.log(firstTx);

        // set `isBounceable` to false to match the address format in TONKeeper
        const receiverAddress: string = new TON_WEB.utils.Address(firstTx?.out_msgs[0]?.destination)?.toString(true, true, false, false);
        // get the parsed message body of the transaction (containing the asset, amount purchased and total cost)
        const txParsedMessage: TxParsedMessage = JSON.parse(firstTx?.out_msgs[0]?.message);
        // get the value of the transaction (amount supposedly sent to `receiverAddress`)
        const txValue = firstTx?.out_msgs[0]?.value;

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
            if (parsedMessageCost !== (txValue / Math.pow(10, 9))) {
                console.error(`(verifyTONTransaction) Value mismatch. Parsed message cost: ${parsedMessageCost}, tx value: ${txValue / Math.pow(10, 9)}`);

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
                    message: `(verifyTONTransaction) Value mismatch. Currency paid: ${txParsedMessage.curr}. Parsed message cost: ${parsedMessageCost}, tx value: ${txValue}`,
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
            console.error(`(verifyTONTransaction) Item mismatch. Parsed message asset: ${txParsedMessage.asset}, purchase asset: ${assetName}. Parsed message amount: ${txParsedMessage.amt}, purchase amount: ${amount}`);

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
                message: `(verifyTONTransaction) Item mismatch. Parsed message asset: ${txParsedMessage.asset}, purchase asset: ${assetName}. Parsed message amount: ${txParsedMessage.amt}, purchase amount: ${amount}`,
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
                            userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = amount;
                        } else {
                            userUpdateOperations.$push['inventory.items'].$each.push({
                                type: givenContent.content, 
                                amount,
                                totalAmountConsumed: 0,
                                weeklyAmountConsumed: 0
                            });
                        }
                    } else if (givenContent.contentType === 'food') {
                        // add the food to the user's inventory
                        const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex(f => f.type === givenContent.content);
    
                        if (existingFoodIndex !== -1) {
                            userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = amount;
                        } else {
                            userUpdateOperations.$push['inventory.foods'].$each.push({ type: givenContent.content, amount });
                        }
                    } else if (givenContent.contentType === 'igc') {
                        // check if xCookies.
                        if (givenContent.content === 'xCookies') {
                            // add the xCookies to the user's currentXCookies
                            userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = amount;
                            // check if the `extendedXCookieData` contains the source SHOP_PURCHASE. if not, add it. if yes, increment the amount.
                            const shopPurchaseIndex = (user.inventory?.xCookieData?.extendedXCookieData as ExtendedXCookieData[]).findIndex(data => data.source === XCookieSource.SHOP_PURCHASE);
    
                            if (shopPurchaseIndex !== -1) {
                                userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${shopPurchaseIndex}.xCookies`] = amount;
                            } else {
                                userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = { source: XCookieSource.SHOP_PURCHASE, xCookies: amount };
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
                    } else if (givenContent.contentType === 'monthlyPass') {
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

                // update the user's data
                await UserModel.findByIdAndUpdate(user._id, userUpdateOperations);
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
 * Sends a user some KICK tokens for XProtocol Testnet upon registering their account via Twitter.
 */
export const sendKICKUponRegistration = async (walletAddress: string): Promise<ReturnValue> => {
    try {
        const response = await axios.post(
            `https://staging.xprotocol.org/api/faucets-request`,
            {
                addresses: [walletAddress]
            },
            {
                headers: {
                    'x-api-key': process.env.X_PROTOCOL_TESTNET_FAUCET_KEY!,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.ok) {
            return {
                status: Status.SUCCESS,
                message: `(sendKICKUponRegistration) 1 KICK sent successfully.`,
            }
        } else {
            return {
                status: Status.ERROR,
                message: `(sendKICKUponRegistration) Failed to send KICK tokens.`
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(sendKICKUponRegistration) ${err.message}`
        }
    }
}

/**
 * Calls `updatePoints` in the Wonderbits contract to update the user's points in the Wonderbits contract.
 */
export const updatePointsInContract = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(updatePointsInContract) User not found. Twitter ID: ${twitterId}`
            }
        }

        // get the user's wallet address
        const { address } = user?.wallet as UserWallet;

        if (!address) {
            return {
                status: Status.ERROR,
                message: `(updatePointsInContract) Wallet address not found for user.`
            }
        }

        // call the Wonderbits contract to update the user's points
        // get the user's current points
        const { status: currentPointsStatus, message: currentPointsMessage, data: currentPointsData } = await getUserCurrentPoints(twitterId);

        if (currentPointsStatus !== Status.SUCCESS) {
            return {
                status: currentPointsStatus,
                message: `(claimReferralRewards) Error from getUserCurrentPoints: ${currentPointsMessage}`
            }
        }

        const salt = generateHashSalt();
        const dataHash = generateWonderbitsDataHash((user.wallet as UserWallet).address, salt);
        const signature = await DEPLOYER_WALLET(XPROTOCOL_TESTNET_PROVIDER).signMessage(ethers.utils.arrayify(dataHash));

        // round it to the nearest integer because solidity doesn't accept floats
        const updatePointsTx = await WONDERBITS_CONTRACT.updatePoints(
            (user.wallet as UserWallet).address, 
            Math.round(currentPointsData.points), 
            [salt, signature]
        );

        console.log(`(updatePointsInContract) tx hash: ${updatePointsTx.hash}`);

        return {
            status: Status.SUCCESS,
            message: `(updatePointsInContract) Points updated successfully.`,
            data: {
                updatePointsTxHash: updatePointsTx.hash
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updatePointsInContract) ${err.message}`
        }
    }
}

/**
 * Increments the event counter in the Wonderbits contract for a specific Mixpanel event.
 */
export const incrementEventCounterInContract = async (twitterId: string, mixpanelEventHash: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(incrementEventCounterInContract) User not found. Twitter ID: ${twitterId}`
            }
        }

        // get the user's wallet address
        const { address } = user?.wallet as UserWallet;

        if (!address) {
            return {
                status: Status.ERROR,
                message: `(incrementEventCounterInContract) Wallet address not found for user.`
            }
        }

        // call the Wonderbits contract to increment the event counter
        const salt = generateHashSalt();
        const dataHash = generateWonderbitsDataHash(address, salt);
        const signature = await DEPLOYER_WALLET(XPROTOCOL_TESTNET_PROVIDER).signMessage(ethers.utils.arrayify(dataHash));

        // increment the counter for this mixpanel event on the wonderbits contract
        const incrementTx = await WONDERBITS_CONTRACT.incrementEventCounter(address, mixpanelEventHash, [salt, signature]);

        return {
            status: Status.SUCCESS,
            message: `(incrementEventCounterInContract) Event counter incremented successfully.`,
            data: {
                incrementCounterTxHash: incrementTx.hash
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(incrementEventCounterInContract) ${err.message}`
        }
    }
}

/**
 * Gives users some KICK when their KICK is running low (i.e. < 0.1 KICK).
 * 
 * Runs every 5 minutes.
 */
export const batchSendKICK = async (): Promise<void> => {
    try {
        const start = Date.now();

        const users = await UserModel.find({}).lean();

        if (!users || users.length === 0) {
            console.log(`(batchSendKICK) No users found.`);
            return;
        }
        
        const addressesToTopUp: string[] = [];
        
        // loop through each user. get their wallet address. check if their KICK balance is < 0.1 KICK. if yes, add to addressesToTopUp
        const balancePromises = users.map(async user => {
            if (!user.wallet || !user.wallet.address) {
                console.log(`(batchSendKICK) User ${user.twitterUsername} has no wallet address.`);
                return null;
            }

            const { address } = user?.wallet as UserWallet;

            const balance = await XPROTOCOL_TESTNET_PROVIDER.getBalance(address);

            return { 
                address, 
                balance: parseFloat(ethers.utils.formatEther(balance))
            }
        })

        const balances = await Promise.all(balancePromises);

        balances.forEach(data => {
            // check for any addresses with a balance of less than 0.1 KICK
            if (data && data.balance < 0.1) {
                addressesToTopUp.push(data.address);
            }
        });

        if (addressesToTopUp.length === 0) {
            console.log(`(batchSendKICK) No addresses to top up.`);
            return;
        }

        const response = await axios.post(
            `https://staging.xprotocol.org/api/faucets-request`,
            {
                addresses: addressesToTopUp
            },
            {
                headers: {
                    'x-api-key': process.env.X_PROTOCOL_TESTNET_FAUCET_KEY!,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.ok) {
            console.log(`(batchSendKICK) Sent 1 KICK to ${addressesToTopUp.length} addresses successfully.`);
        } else {
            console.error(`(batchSendKICK) Failed to top up addresses. Reason: ${response.data.message}`);
        }
    } catch (err: any) {
        console.error(`(batchSendKICK) Error: ${err.message}`)
    }
}