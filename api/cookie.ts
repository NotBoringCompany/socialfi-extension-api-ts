import mongoose from 'mongoose'
import { ReturnValue, Status } from '../utils/retVal'
import { UserSchema } from '../schemas/User';
import { COOKIE_CONTRACT_DECIMALS, COOKIE_CONTRACT_USER } from '../utils/constants/web3';
import { CookieDepositSchema } from '../schemas/Cookie';
import { generateObjectId } from '../utils/crypto';

/**
 * (User) Deposits `amount` of cookies and earn the equivalent amount of xCookies.
 */
export const depositCookies = async (twitterId: string, amount: number): Promise<ReturnValue> => {
    const User = mongoose.model('Users', UserSchema, 'Users');
    const CookieDeposit = mongoose.model('CookieDeposits', CookieDepositSchema, 'CookieDeposits');

    try {
        const user = await User.findOne({ twitterId });
        
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(depositCookies) User not found.`
            }
        }

        // get the user's private key
        const privateKey = user.wallet.privateKey;

        // get the cookie contract instance (with user's private key)
        const cookieContract = COOKIE_CONTRACT_USER(privateKey);

        const result = await cookieContract.deposit(amount * 10 ** COOKIE_CONTRACT_DECIMALS, {
            gasLimit: 200000
        });

        // wait for at least 3 confirmations
        await result.wait(3);

        // we dont check for errors here since it will directly go to the catch block if there's an error
        // we just deposit the same amount of cookies to the user's xCookies balance
        await User.updateOne({ twitterId }, {
            $inc: {
                xCookies: amount
            }
        });

        // we add an instance of the deposit to the CookieDeposits collection
        const latestDepositId = await getLatestDepositId();
        
        const deposit = new CookieDeposit({
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
 * Gets the latest cookie deposit ID.
 */
export const getLatestDepositId = async (): Promise<ReturnValue> => {
    const CookieDeposit = mongoose.model('CookieDeposits', CookieDepositSchema, 'CookieDeposits');

    try {
        // we count the amount of documents in the collection
        const count = await CookieDeposit.countDocuments();

        return {
            status: Status.SUCCESS,
            message: `(getLatestDepositId) Latest deposit ID: ${count}`,
            data: {
                depositId: count
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLatestDepositId) Error: ${err.message}`
        }
    }
}