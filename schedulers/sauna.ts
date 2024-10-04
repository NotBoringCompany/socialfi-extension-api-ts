import Bull from "bull";
import { energyRecover } from "../api/sauna";
import { getSocket } from "../socket";
import { Status } from "../utils/retVal";
export const saunaQueue = new Bull('saunaQueue', {
  redis: process.env.REDIS_URL
});

saunaQueue.process(async (job) => {
  const { userId, socketId, getTotalEnergy } = job.data;
  await energyRecover(userId);
  const io = getSocket();
  io.emit('server_response', { status: Status.SUCCESS, message: `(energyRecover) user ${userId} recover ${getTotalEnergy} energy` });
});