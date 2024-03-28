import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * Cookie Deposit schema. Represents closely to the `CookieDeposit` interface in `models/cookieDeposit.ts`.
 */
export const CookieDepositSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    depositor: String,
    depositId: Number,
    amount: Number,
    transactionHash: String,
    timestamp: Number
})

/**
 * Cookie Withdrawal schema. Represents closely to the `CookieWithdrawal` interface in `models/cookieWithdrawal.ts`.
 */
export const CookieWithdrawalSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    withdrawer: String,
    withdrawalId: Number,
    amount: Number,
    hashSalt: String,
    signature: String,
    transactionHash: String,
    timestamp: Number
})