import { Socket } from "socket.io";
import { SAUNA_LIST } from "../utils/constants/sauna";
import { SaunaUserDetail } from "../models/sauna";
import Bull from "bull";
import { Status } from "../utils/retVal";

const saunaQueue = new Bull('saunaQueue', {
  redis: process.env.REDIS_URL
});

const DUMMY_DATA = new Array(3).fill(null).map((_, i) => ({
  id: (i + 1).toString(),
  createdTimestamp: Math.floor(Date.now() / 1000),
  inGameData: {
    energy: {
      currentEnergy: Math.floor(Math.random() * 100),
      maxEnergy: 100,
      dailyEnergyPotion: Math.floor(Math.random() * 5),
    }
  }
}));

const userSockets = new Map<string, Socket>();

export const startRest = (socket: Socket, data: SaunaUserDetail) => {
  console.log('new user start rest', data);
  const { userId } = data;
  const user = DUMMY_DATA.find((user) => user.id === userId);

  if (!user) {
    socket.emit('server_response', {
      status:Status.BAD_REQUEST, 
      message: "user not found"
    });
    return;
  }

  // Avoid if user already full of energy
  if (user.inGameData.energy.currentEnergy === user.inGameData.energy.maxEnergy) {
    socket.emit('server_response', {
      status:Status.BAD_REQUEST,
      message:"user has max energy"
    });
    return;
  }

  // Avoid same user id in the list
  if (SAUNA_LIST.userDetail.find((user) => user.userId === userId)) {
    socket.emit('server_response', {
      status:Status.BAD_REQUEST, 
      message:"user already connected"
    });
    return;
  }

  const currentEnergy = user.inGameData.energy.currentEnergy;
  const maxEnergy = user.inGameData.energy.maxEnergy;
  const percentage = maxEnergy * 0.2; // 20%
  const energyPotionPerSecond = percentage / 60; // 20% per second
  const lack = Math.abs(maxEnergy - currentEnergy); // How much energy is rest
  const timeToMaxEnergy = lack / energyPotionPerSecond; // how long the Time to recover to max
  const timeToMaxEnergyInMiliSecond = timeToMaxEnergy * 1000;

  userSockets.set(userId, socket);

  saunaQueue.add({
    userId,
    maxEnergy,
    timeToMaxEnergyInMiliSecond
  }, {
    jobId:userId,
    delay: timeToMaxEnergyInMiliSecond // Delay job execution based on time to max energy
  });

  socket.on('disconnect', async () => {
    const getJobId = await saunaQueue.getJob(userId)
    if(getJobId){
      getJobId.remove()
      console.log('job remove with socket id', socket.id)
      console.log('user id', userId)
      socket.emit('server_response',{
        status:Status.SUCCESS, 
        message:"Succes disconnect from sauna"
      })
    }
    userSockets.delete(userId);
    SAUNA_LIST.userConnected -= 1;
    SAUNA_LIST.userDetail = SAUNA_LIST.userDetail.filter((user) => user.userId !== userId);
  });

  SAUNA_LIST.userConnected += 1;
  SAUNA_LIST.userDetail.push({ userId: userId, timestamp: Math.floor(Date.now() / 1000) });

  socket.emit('server_response', {
    status:Status.SUCCESS,
    message:"Succes connected to sauna", 
    data:SAUNA_LIST
  });
};

saunaQueue.process(async (job) => {
  const { userId } = job.data;
  const user = DUMMY_DATA.find((user) => user.id === userId);

  if (user) {
    user.inGameData.energy.currentEnergy = user.inGameData.energy.maxEnergy;
    const userSocket = userSockets.get(userId);
    if (userSocket) {
      userSocket.emit('server_response', {
        message: `Energy fully recovered for user ${userId}`,
        user
      });
    }
  }
});