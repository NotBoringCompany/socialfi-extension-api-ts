import http from 'http';
import { Server, Socket } from 'socket.io';

import { validateJWT } from '../utils/jwt';
import { Status } from '../utils/retVal';
import { ChatroomModel, UserModel } from '../utils/constants/db';
import { handleChatEvents } from '../events/chat';
import { redis } from '../utils/constants/redis';
import { handleSaunaEvents } from '../events/sauna';

let io: Server | null = null;

export const initializeSocket = (server: http.Server) => {
    io = new Server(server, {
        cors: {
            origin: '*',
        },
    });

    // JWT validation middleware
    io.use(async (socket: Socket, next) => {
        try {
            // retrieve JWT token from the query
            const token = socket.handshake.query.token as string;

            if (!token) {
                console.error('Authentication error: No token provided');
                return next(new Error('Authentication error: No token provided'));
            }

            // validate JWT
            const validate = validateJWT(token);
            if (validate.status !== Status.SUCCESS) {
                console.error('Authentication error: Invalid token');
                return next(new Error('Authentication error: Invalid token'));
            }

            const user = await UserModel.findOne({ twitterId: validate.data.twitterId });
            if (!user) {
                console.error('Authentication error: User not found');
                return next(new Error('Authentication error: User not found'));
            }

            // attach the user ID to the socket data
            socket.data.userId = user._id.toString();
            next();
        } catch (error) {
            console.error('Authentication error:', error);
            return next(new Error('Authentication error'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.data.userId as string;

        // if the userId didn't exist then return authentication error
        if (!userId) throw new Error('Authentication error');

        // fetch chatrooms where the user is a participant
        const chatrooms = await ChatroomModel.find({ 'participants.user': userId });

        // make the user join all the chatrooms they've participated in
        chatrooms.forEach((chatroom) => {
            socket.join(chatroom._id); // Join chatroom based on its ID
        });

        // store the connected user's socket ID in Redis
        await redis.set(`socket_user_${userId}`, socket.id);

        // chat event listener
        handleChatEvents(socket, io);
        // sauna event listener
        handleSaunaEvents(socket);

        // handle user disconnection
        socket.on('disconnect', async () => {
            if (userId) {
                await redis.del(`socket_user_${userId}`);
                console.log(`User ${userId} disconnected and removed from Redis`);
            }
        });
    });
};
