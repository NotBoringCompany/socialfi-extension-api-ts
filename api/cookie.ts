import { ReturnValue, Status } from '../utils/retVal'
import { BLAST_TESTNET_PROVIDER, COOKIE_CONTRACT_DECIMALS, COOKIE_CONTRACT_USER, DEPLOYER_WALLET } from '../utils/constants/web3';
import { decryptPrivateKey, generateHashSalt, generateObjectId } from '../utils/crypto';
import { ethers } from 'ethers';
import { CookieDepositModel, CookieWithdrawalModel, UserModel } from '../utils/constants/db';
import { ExtendedXCookieData, XCookieSource } from '../models/user';

/**
 * (User) Deposits `amount` of cookies and earn the equivalent amount of xCookies.
 */
export const depositCookies = async (twitterId: string, amount: number): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();
        
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(depositCookies) User not found.`
            }
        }

        // get the user's private key
        const encryptedPrivateKey = user.wallet.encryptedPrivateKey;
        const privateKey = decryptPrivateKey(encryptedPrivateKey);

        // get the cookie contract instance (with user's private key)
        const cookieContract = COOKIE_CONTRACT_USER(privateKey);

        const result = await cookieContract.deposit(amount * 10 ** COOKIE_CONTRACT_DECIMALS, {
            gasLimit: 200000
        });

        // 3 confirmations just for safety
        await result.wait(3);

        // we dont check for errors here since it will directly go to the catch block if there's an error
        // 1. we increment the user's xCookies balance by the amount of cookies deposited
        // 2. we check if the user's `extendedXCookieData.source` has COOKIE_DEPOSIT. If not, we add a new COOKIE_DEPOSIT instance.
        const cookieDepositIndex = (user.inventory?.extendedXCookieData as ExtendedXCookieData[]).findIndex(data => data.source === XCookieSource.COOKIE_DEPOSIT);

        if (cookieDepositIndex !== -1) {
            await UserModel.updateOne({ twitterId }, {
                $inc: {
                    [`inventory.xCookieData.extendedXCookieData.${cookieDepositIndex}.xCookies`]: amount,
                    'inventory.xCookieData.currentXCookies': amount
                }
            })
        } else {
            await UserModel.updateOne({ twitterId }, {
                $inc: {
                    'inventory.xCookieData.currentXCookies': amount
                },
                $push: {
                    'inventory.xCookieData.extendedXCookieData': {
                        xCookies: amount,
                        source: XCookieSource.COOKIE_DEPOSIT,
                    }
                }
            })
        }

        // we add an instance of the deposit to the CookieDeposits collection
        const latestDepositId = await getLatestDepositId();
        
        const deposit = new CookieDepositModel({
            _id: generateObjectId(),
            depositor: twitterId,
            depositId: latestDepositId.data.depositId + 1,
            amount: amount,
            transactionHash: result.hash,
            timestamp: Math.floor(Date.now() / 1000)
        });

        await deposit.save();
    
        return {
            status: Status.SUCCESS,
            message: `(depositCookies) Deposited ${amount} cookies successfully.`,
            data: {
                txResult: result,
                amount: amount
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(depositCookies) Error: ${err.message}`
        }
    }
}

/**
 * (User) Withdraws `amount` of xCookies and earn the equivalent amount of cookies in the blockchain.
 */
export const withdrawCookies = async (twitterId: string, amount: number): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(withdrawCookies) User not found.`
            }
        }

        const xCookies = user.inventory?.xCookieData.currentXCookies;

        if (xCookies < amount) {
            return {
                status: Status.ERROR,
                message: `(withdrawCookies) Insufficient xCookies.`
            }
        }

        // get the user's private key
        const encryptedPrivateKey = user.wallet.encryptedPrivateKey;
        const privateKey = decryptPrivateKey(encryptedPrivateKey);

        const hashSalt = generateHashSalt();
        const timestamp = Math.floor(Date.now() / 1000);

        // call the `getWithdrawHash` function from the contract
        const withdrawHash = await COOKIE_CONTRACT_USER(privateKey).getWithdrawHash(
            user.wallet.address,
            amount * 10 ** COOKIE_CONTRACT_DECIMALS,
            timestamp,
            hashSalt
        );

        // sign the withdraw hash using the deployer wallet's private key
        const signature = await DEPLOYER_WALLET(BLAST_TESTNET_PROVIDER).signMessage(ethers.utils.arrayify(withdrawHash));

        // call the `withdraw` function from the contract
        const result = await COOKIE_CONTRACT_USER(privateKey).withdraw(
            amount * 10 ** COOKIE_CONTRACT_DECIMALS,
            hashSalt,
            timestamp,
            signature,
            {
                gasLimit: 1000000
            }
        );

        // 3 confirmations just for safety
        await result.wait(3);

        // we dont check for errors here since it will directly go to the catch block if there's an error
        // we just withdraw the same amount of cookies from the user's xCookies balance
        await UserModel.updateOne({ twitterId }, {
            $inc: {
                'inventory.xCookieData.currentXCookies': -amount
            }
        });

        // we add an instance of the withdrawal to the CookieWithdrawals collection
        const latestWithdrawalId = await getLatestWithdrawalId();

        const withdrawal = new CookieWithdrawalModel({
            _id: generateObjectId(),
            withdrawer: twitterId,
            withdrawalId: latestWithdrawalId.data.withdrawalId + 1,
            amount,
            hashSalt,
            signature,
            transactionHash: result.hash,
            timestamp
        });

        await withdrawal.save();

        return {
            status: Status.SUCCESS,
            message: `(withdrawCookies) Withdrawn ${amount} xCookies successfully.`,
            data: {
                txResult: result,
                amount: amount
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(withdrawCookies) Error: ${err.message}`
        }
    }
}

/**
 * Gets the latest cookie deposit ID.
 */
export const getLatestDepositId = async (): Promise<ReturnValue> => {
    try {
        // get the latest deposit id by sorting the collection in descending order and getting the first document
        const latestDeposit = await CookieDepositModel.findOne().sort({ depositId: -1 }).lean();

        return {
            status: Status.SUCCESS,
            message: `(getLatestDepositId) Latest deposit ID: ${latestDeposit}`,
            data: {
                depositId: latestDeposit ? latestDeposit.depositId : 0
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLatestDepositId) Error: ${err.message}`
        }
    }
}

export const getLatestWithdrawalId = async (): Promise<ReturnValue> => {
    try {
        // get the latest withdrawal id by counting the number of documents in the collection
        const latestWithdrawal = await CookieWithdrawalModel.findOne().sort({ withdrawalId: -1 }).lean();

        return {
            status: Status.SUCCESS,
            message: `(getLatestWithdrawalId) Latest withdrawal ID: ${latestWithdrawal}`,
            data: {
                withdrawalId: latestWithdrawal ? latestWithdrawal.withdrawalId : 0
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLatestWithdrawalId) Error: ${err.message}`
        }
    }
}

/**
 * Fetches the number of xCookies owned by the user.
 */
export const getOwnedXCookies = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getOwnedXCookies) User not found. Twitter ID: ${twitterId}`
            }
        }

        // return the number of xCookies owned by the user
        return {
            status: Status.SUCCESS,
            message: `(getOwnedXCookies) xCookies found.`,
            data: {
                xCookies: user.inventory.xCookieData.currentXCookies
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getOwnedXCookies) ${err.message}`
        }
    }
}