import { Server as HttpServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';
import { validateJWT } from '../utils/jwt';
import { Status } from '../utils/retVal';
import { UserModel } from '../utils/constants/db';
import { saunaEvent } from './event/saunaEvent';

let io: SocketIOServer | null = null;

export const initSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
    },
  });
  // this middleware copy from chat system 
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

  io.on('connection', (socket) => {
    // move this event if merge 
    saunaEvent(socket);
  });

  return io;
};

export const getSocket = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};
