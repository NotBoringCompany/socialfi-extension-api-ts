import Bull from "bull";
import { energyRecover } from "../api/sauna";
import { getSocket } from "../socket";
import { Status } from "../utils/retVal";
export const saunaQueue = new Bull('saunaQueue', {
  redis: process.env.REDIS_URL
});

saunaQueue.process(async (job) => {
  try {
    const { userId, socketId, getTotalEnergy } = job.data;
    const io = getSocket();
    await energyRecover(userId, getTotalEnergy);
    console.log(`(saunaQueue) user ${userId} recover ${getTotalEnergy} energy`);
    io.to(socketId).emit('server_response', { status: Status.SUCCESS, message: `(saunaQueue) user ${userId} recover ${getTotalEnergy} energy` })
  } catch (error) {
    console.error(error);
  }
});