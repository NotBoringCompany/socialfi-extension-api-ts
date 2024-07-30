import axios from 'axios';
import { WONDERBITS_CONTRACT, XPROTOCOL_TESTNET_PROVIDER } from '../utils/constants/web3';
import { ReturnValue, Status } from '../utils/retVal';
import { ethers } from 'ethers';
import { UserWallet } from '../models/user';
import { UserModel } from '../utils/constants/db';

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
            // check for any addresses with a balance of less than 0.15 KICK
            if (data && data.balance < 0.15) {
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