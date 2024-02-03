import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { UserSchema } from '../schemas/User';

/**
 * Twitter login logic. Creates a new user or simply log them in if they already exist.
 */
export const handleTwitterLogin = async (twitterId: string): Promise<ReturnValue> => {
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        const user = await User.findOne({ twitterId });

        // if user doesn't exist, create a new user
        if (!user) {
            const newUser = new User({
                twitterId
            });

            await newUser.save();

            return {
                status: Status.SUCCESS,
                message: 'User created.',
                data: {
                    userId: newUser._id,
                    twitterId
                }
            }
        } else {
            // user exists, return
            return {
                status: Status.SUCCESS,
                message: 'User exists. Logging in.',
                data: {
                    userId: user._id,
                    twitterId
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: err.message
        }
    }
}