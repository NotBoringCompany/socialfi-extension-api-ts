import axios from 'axios';
import { ReturnValue, Status } from '../utils/retVal';
import { ShopAssetPurchaseModel, UserModel } from '../utils/constants/db';
import { UserWallet } from '../models/user';
import { getUserCurrentPoints } from './leaderboard';
import { generateHashSalt, generateWonderbitsDataHash } from '../utils/crypto';
import { BINANCE_API_BASE_URL, DEPLOYER_WALLET, GATEIO_API_BASE_URL, KUCOIN_API_BASE_URL, TON_RECEIVER_ADDRESS, TON_WEB, WONDERBITS_CONTRACT, XPROTOCOL_TESTNET_PROVIDER } from '../utils/constants/web3';
import { ethers } from 'ethers';
import { TxParsedMessage } from '../models/web3';

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
 * Verifies a transaction made in TON given the purchase ID (database ID of the purchase), sender's address and BOC of the transaction.
 */
export const verifyTONTransaction = async (purchaseId: string, address: string, boc: string): Promise<ReturnValue> => {
    if (!purchaseId || purchaseId === '') {
        console.error(`(decodeTx) Purchase ID not found.`);
        return {
            status: Status.ERROR,
            message: `(decodeTx) Purchase ID not found.`
        }
    }

    if (!address || address === '') {
        console.error(`(decodeTx) Address not found.`);
        return {
            status: Status.ERROR,
            message: `(decodeTx) Address not found.`
        }
    }

    if (!boc || boc === '') {
        console.error(`(decodeTx) BOC not found.`);
        return {
            status: Status.ERROR,
            message: `(decodeTx) BOC not found.`
        }
    }

    try {
        // get the ShopAssetPurchase document
        const purchase = await ShopAssetPurchaseModel.findById(purchaseId).lean();

        if (!purchase) {
            console.error(`(decodeTx) Purchase not found. ID: ${purchaseId}`);
            return {
                status: Status.ERROR,
                message: `(decodeTx) Purchase not found. ID: ${purchaseId}`
            }
        }

        const txHash = await bocToTxHash(boc);

        console.log(`tx hash: ${txHash}`);

        // `getTransactions` will return an array of transactions, even if we're only fetching one transaction
        const txs = await TON_WEB.provider.getTransactions(
            address,
            1,
            null,
            txHash
        );

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
            console.error(`(decodeTx) Receiver address mismatch. Expected: ${TON_RECEIVER_ADDRESS}, got: ${receiverAddress}`);

            // update the purchase's `blockchainData.confirmationAttempts` to include the error `noValidTx`
            await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                $push: {
                    'blockchainData.confirmationAttempts': 'noValidTx'
                },
                'blockchainData.txPayload': txParsedMessage
            });

            return {
                status: Status.ERROR,
                message: `(decodeTx) Receiver address mismatch. Expected: ${TON_RECEIVER_ADDRESS}, got: ${receiverAddress}`
            }
        }
        

        // if the currency is "TON", then `txValue` MUST be the same as `txParsedMessage.cost`
        // because the cost of the transaction should be the same as the value sent to the receiver (value = native currency of the tx, which is TON)
        // if NOT or other coins, then value most likely won't match because it's not paid with TON (so TBD).
        if (txParsedMessage.curr === 'TON') {
            const parsedMessageCost = txParsedMessage.cost;

            if (txValue !== parsedMessageCost) {
                console.error(`(decodeTx) Value mismatch. Parsed message cost: ${parsedMessageCost}, tx value: ${txValue}`);

                // update the purchase's `blockchainData.confirmationAttempts` to include the error `noValidTx`
                await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                    $push: {
                        'blockchainData.confirmationAttempts': 'noValidTx'
                    },
                    'blockchainData.txPayload': txParsedMessage
                })

                return {
                    status: Status.ERROR,
                    message: `(decodeTx) Value mismatch. Currency paid: ${txParsedMessage.curr}. Parsed message cost: ${parsedMessageCost}, tx value: ${txValue}`
                }
            }
        }

        // finally, check if the items given to the user match the items purchased (by checking the `txParsedMessage.asset` compared to the `purchase.assetName`)
        // and if the amount of the asset given to the user matches the amount purchased (by checking the `txParsedMessage.amt` compared to the `purchase.amount`)
        if (txParsedMessage.asset !== purchase.assetName || txParsedMessage.amt !== purchase.amount) {
            console.error(`(decodeTx) Item mismatch. Parsed message asset: ${txParsedMessage.asset}, purchase asset: ${purchase.assetName}. Parsed message amount: ${txParsedMessage.amt}, purchase amount: ${purchase.amount}`);

            // update the purchase's `blockchainData.confirmationAttempts` to include the error `itemMismatch`
            await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
                $push: {
                    'blockchainData.confirmationAttempts': 'itemMismatch'
                },
                'blockchainData.txPayload': txParsedMessage
            });

            return {
                status: Status.ERROR,
                message: `(decodeTx) Item mismatch. Parsed message asset: ${txParsedMessage.asset}, purchase asset: ${purchase.assetName}. Parsed message amount: ${txParsedMessage.amt}, purchase amount: ${purchase.amount}`
            }
        }

        // if all checks pass, update the purchase's `blockchainData.confirmationAttempts` to include `success`
        // as well as the `txPayload` as `txParsedMessage`
        await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
            $push: {
                'blockchainData.confirmationAttempts': 'success'
            },
            'blockchainData.txPayload': txParsedMessage
        });

        return {
            status: Status.SUCCESS,
            message: `(decodeTx) Transaction verified successfully.`
        }
    } catch (err: any) {
        console.error(`(decodeTx) Error: ${err.message}`);

        // update the purchase's `blockchainData.confirmationAttempts` to include the error `apiError`
        await ShopAssetPurchaseModel.findByIdAndUpdate(purchaseId, {
            $push: {
                'blockchainData.confirmationAttempts': 'apiError'
            }
        })
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
        
        const binanceResponse = await axios.get(BINANCE_URL);

        // if the request is successful, return the response, else try KuCoin
        if (binanceResponse.status === 200) {
            // binance returns an array of objects with their symbol and price (tickers). we need to extract the price for TON and NOT
            const TONTicker = binanceResponse.data[1].price;
            const NOTTicker = binanceResponse.data[0].price;

            console.log(`TON: ${TONTicker}`);
            console.log(`NOT: ${NOTTicker}`);

            return {
                status: Status.SUCCESS,
                message: `(fetchIAPTickers) Tickers fetched successfully.`,
                data: {
                    TONTicker,
                    NOTTicker
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
                    TONTicker,
                    NOTTicker
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
                    TONTicker,
                    NOTTicker
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