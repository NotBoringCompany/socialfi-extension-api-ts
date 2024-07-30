import axios from 'axios';
import { DEPLOYER_WALLET, WONDERBITS_CONTRACT, WONDERBITS_CONTRACT_USER, XPROTOCOL_TESTNET_PROVIDER } from '../utils/constants/web3';
import { ReturnValue, Status } from '../utils/retVal';
import { ethers } from 'ethers';
import { UserWallet } from '../models/user';
import { UserModel } from '../utils/constants/db';
import { getUserCurrentPoints } from './leaderboard';
import { generateHashSalt, generateWonderbitsDataHash } from '../utils/crypto';

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
        const { privateKey, address } = user?.wallet as UserWallet;

        if (!address) {
            return {
                status: Status.ERROR,
                message: `(updatePointsInContract) Wallet address not found for user.`
            }
        }

        // check if the wallet has at least 0.01 KICK. if not, send them 1 KICK.
        const balance = await XPROTOCOL_TESTNET_PROVIDER.getBalance(address).catch((err: any) => {
            return ethers.BigNumber.from(0);
        })

        if (parseFloat(ethers.utils.formatEther(balance)) < 0.01) {
            const response = await axios.post(
                `https://staging.xprotocol.org/api/faucets-request`,
                {
                    addresses: [address]
                },
                {
                    headers: {
                        'x-api-key': process.env.X_PROTOCOL_TESTNET_FAUCET_KEY!,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.ok) {
                console.error(`(incrementEventCounterInContract) Failed to send KICK tokens and user's balance is < 0.01 KICK.`);
            } else {
                console.log(`(incrementEventCounterInContract) Sent 1 KICK to user successfully.`);
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
        const updatePointsTx = await WONDERBITS_CONTRACT_USER(privateKey).updatePoints(
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
        console.error(`(updatePointsInContract) Error: ${err.message}`);
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
        const { privateKey, address } = user?.wallet as UserWallet;

        if (!address) {
            return {
                status: Status.ERROR,
                message: `(incrementEventCounterInContract) Wallet address not found for user.`
            }
        }

        // check if the wallet has at least 0.01 KICK. if not, send them 1 KICK.
        const balance = await XPROTOCOL_TESTNET_PROVIDER.getBalance(address).catch((err: any) => {
            return ethers.BigNumber.from(0);
        })

        if (parseFloat(ethers.utils.formatEther(balance)) < 0.01) {
            const response = await axios.post(
                `https://staging.xprotocol.org/api/faucets-request`,
                {
                    addresses: [address]
                },
                {
                    headers: {
                        'x-api-key': process.env.X_PROTOCOL_TESTNET_FAUCET_KEY!,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.ok) {
                console.error(`(incrementEventCounterInContract) Failed to send KICK tokens and user's balance is < 0.01 KICK.`);
            } else {
                console.log(`(incrementEventCounterInContract) Sent 1 KICK to user successfully.`);
            }
        }


        // call the Wonderbits contract to increment the event counter
        const salt = generateHashSalt();
        const dataHash = generateWonderbitsDataHash(address, salt);
        const signature = await DEPLOYER_WALLET(XPROTOCOL_TESTNET_PROVIDER).signMessage(ethers.utils.arrayify(dataHash));

        // increment the counter for this mixpanel event on the wonderbits contract
        const incrementTx = await WONDERBITS_CONTRACT_USER(privateKey).incrementEventCounter(address, mixpanelEventHash, [salt, signature]);

        return {
            status: Status.SUCCESS,
            message: `(incrementEventCounterInContract) Event counter incremented successfully.`,
            data: {
                incrementCounterTxHash: incrementTx.hash
            }
        }
    } catch (err: any) {
        console.error(`(incrementEventCounterInContract) Error: ${err.message}`);
        return {
            status: Status.ERROR,
            message: `(incrementEventCounterInContract) ${err.message}`
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
 * Gives users some KICK when their KICK is running low (i.e. < 0.15 KICK).
 * 
 * Runs every 10 minutes.
 */
export const batchSendKICK = async (): Promise<void> => {
    try {
        const users = await UserModel.find({}).lean();

        if (!users || users.length === 0) {
            console.log(`(batchSendKICK) No users found.`);
            return;
        }
        
        const addressesToTopUp: string[] = [];
        
        // loop through each user. get their wallet address. check if their KICK balance is < 0.15 KICK. if yes, add to addressesToTopUp
        const balancePromises = users.map(async user => {
            if (!user.wallet || !user.wallet.address) {
                return null;
            }

            const { address } = user?.wallet as UserWallet;

            const balance = await XPROTOCOL_TESTNET_PROVIDER.getBalance(address).catch((err: any) => {
                return ethers.BigNumber.from(0);
            })

            return { 
                address, 
                balance: parseFloat(ethers.utils.formatEther(balance))
            }
        })

        const balances = await Promise.all(balancePromises);

        balances.forEach(data => {
            // check for any addresses with a balance of less than 0.15 KICK
            if (data && data.balance < 0.15) {
                addressesToTopUp.push(data.address);
            }
        });

        if (addressesToTopUp.length === 0) {
            console.log(`(batchSendKICK) No addresses to top up.`);
            return;
        }

        // send 1 KICK to 250 addresses at a time to avoid rate limiting
        for (let i = 0; i < addressesToTopUp.length; i += 250) {
            const addrChunk = addressesToTopUp.slice(i, i + 250);
            const response = await axios.post(
                `https://staging.xprotocol.org/api/faucets-request`,
                {
                    addresses: addrChunk
                },
                {
                    headers: {
                        'x-api-key': process.env.X_PROTOCOL_TESTNET_FAUCET_KEY!,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.ok) {
                console.log(`(batchSendKICK) Sent 1 KICK to ${addrChunk} addresses successfully.`);
            } else {
                console.error(`(batchSendKICK) Failed to top up addresses. Reason: ${response.data.message}`);
            }
        }
    } catch (err: any) {
        console.error(`(batchSendKICK) Error: ${err.message}`)
    }
}

// get user from wallet address
export const getUser = async (walletAddress: string): Promise<void> => {
    try {

    } catch (err: any) {
        console.error(`(getUser) Error: ${err.message}`);
    }
}