import Bull from "bull";
import { getSocket } from "../socket";
export const saunaQueue = new Bull('saunaQueue', {
  redis: process.env.REDIS_URL
});

saunaQueue.process(async (job) => {
  try {
    const { userId, socketId, getTotalEnergy } = job.data;
    const socket = getSocket();
    // mybe right here we can send token or something 
    // todo we should send user token
    socket.to(socketId).emit('check_alive',
      { message: "Are you still there?", userId, socketId, getTotalEnergy }
    );
    console.log(`sauna ask user ${userId} are you still there?`);
  } catch (error) {
    console.error(error);
  }
});