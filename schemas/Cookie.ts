import mongoose from 'mongoose';

/**
 * Cookie Deposit schema. Represents closely to the `CookieDeposit` interface in `models/cookieDeposit.ts`.
 */
export const CookieDepositSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: new mongoose.Types.ObjectId()
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
        default: new mongoose.Types.ObjectId()
    },
    withdrawer: String,
    withdrawalId: Number,
    amount: Number,
    transactionHash: String,
    timestamp: Number
})