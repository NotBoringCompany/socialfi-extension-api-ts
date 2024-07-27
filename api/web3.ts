import axios from 'axios';
import { ReturnValue, Status } from '../utils/retVal';
import { UserModel } from '../utils/constants/db';
import { UserWallet } from '../models/user';
import { getUserCurrentPoints } from './leaderboard';
import { generateHashSalt, generateWonderbitsDataHash } from '../utils/crypto';
import { DEPLOYER_WALLET, WONDERBITS_CONTRACT, XPROTOCOL_TESTNET_PROVIDER } from '../utils/constants/web3';
import { ethers } from 'ethers';
import { RENAME_BIT_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';

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