import mongoose from 'mongoose';

export const UserSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: new mongoose.Types.ObjectId()
    },
    // when logged in via twitter, the user's twitterId is stored
    twitterId: String
})