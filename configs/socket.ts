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
                return next(new Error('Authentication error: No token provided'));
            }

            // validate JWT
            const validate = validateJWT(token);
            if (validate.status !== Status.SUCCESS) {
                return next(new Error('Authentication error: Invalid token'));
            }

            const user = await UserModel.findOne({ twitterId: validate.data.twitterId });
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            // attach the user ID to the socket data
            socket.data.userId = user._id.toString();
            next();
        } catch (error) {
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
        await addSocketUser(userId, socket.id);

        // chat event listener
        handleChatEvents(socket, io);
        // sauna event listener
        handleSaunaEvents(socket);

        // handle user disconnection
        socket.on('disconnect', async () => {
            if (userId) {
                await removeSocketUser(userId, socket.id);
                console.log(`User ${userId} disconnected and removed from Redis`);
            }
        });
    });
};

// Add a socket ID to a specific user
export const addSocketUser = async (userId: string, socketId: string) => {
    const key = `user_sockets:${userId}`;
    await redis.hset(key, socketId, Date.now()); // Optionally store the timestamp for expiry or tracking
};

// Remove a socket ID for a specific user
const removeSocketUser = async (userId: string, socketId: string) => {
    const key = `user_sockets:${userId}`;
    await redis.hdel(key, socketId); // Remove the socket ID from the user's hash
};

// Get all socket IDs for a user
export const getSocketUsers = async (userId: string): Promise<string[]> => {
    const key = `user_sockets:${userId}`;
    const socketIds = await redis.hkeys(key); // Get all socket IDs (fields)
    return socketIds;
};
