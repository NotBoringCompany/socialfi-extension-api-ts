import mongoose from 'mongoose';

/**
 * Lottery schema. Represents closely to the `Lottery` interface in `models/lottery.ts`.
 */
export const LotterySchema = new mongoose.Schema({
    _id: {
        type: String,
        default: new mongoose.Types.ObjectId()
    },
    drawId: Number,
    open: Boolean,
    createdTimestamp: Number,
    finalizationTimestamp: Number,
    tickets: Array,
    winningNumbers: Array,
    merkleRoot: String,
    serverSeed: String,
    hashedServerSeed: String,
    drawSeed: String,
    winners: Array
})