import http from 'http';
import { Server, Socket } from 'socket.io';
import { validateJWT } from '../utils/jwt';
import { Status } from '../utils/retVal';
import { UserModel } from '../utils/constants/db';
import redis from './redis';

export const initializeSocket = (server: http.Server) => {
    const io = new Server(server, {
        cors: {
            origin: '*',
        },
    });

    // jwt validation middleware
    io.use(async (socket: Socket, next) => {
        // retrieve jwt token from the query
        const token = socket.handshake.query.token as string; // JWT token passed as query

        if (!token) {
            return next(new Error('Authentication error'));
        }

        const validate = validateJWT(token);
        if (validate.status !== Status.SUCCESS) {
            return next(new Error('Authentication error'));
        }

        const user = await UserModel.findOne({ twitterId: validate.data.twitterId });
        if (!user) {
            return next(new Error('Authentication error'));
        }

        // assign socket user id using database user._id
        socket.data.userId = user._id;
    });

    io.on('connection', async (socket) => {
        // retrieve user._id from jwt validation middleware
        const userId = socket.data.userId;

        // store connected users
        if (userId) {
            await redis.set(userId, socket.id);
        }

        socket.on('disconnect', async () => {
            // remove connected user from redis upon disconnection
            if (userId) {
                await redis.del(userId);
            }
        });
    });
};
