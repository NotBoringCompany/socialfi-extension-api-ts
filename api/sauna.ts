import { Socket } from "socket.io";
import { SAUNA_LIST } from "../utils/constants/sauna";
import { SaunaUserDetail } from "../models/sauna";
import { Status } from "../utils/retVal";
import redisDb from "../utils/constants/redisDb";
import { saunaQueue } from "../schedulers/sauna";

enum RedisKey {
  USERS = "userList",
  CONNECTED = "connected"
}



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
// save this to redis
const userSockets = new Map<string, Socket>();

export const startRest = async (socket: Socket, data: SaunaUserDetail) => {
  console.log('new user start rest', data);
  const { userId } = data;
  const user = DUMMY_DATA.find((user) => user.id === userId);

  if (!user) {
    socket.emit('server_response', {
      status: Status.BAD_REQUEST,
      message: "user not found"
    });
    return;
  }

  // Avoid if user already full of energy
  if (user.inGameData.energy.currentEnergy === user.inGameData.energy.maxEnergy) {
    socket.emit('server_response', {
      status: Status.BAD_REQUEST,
      message: "user has max energy"
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
  console.log('time to max energy', (timeToMaxEnergyInMiliSecond / 60) / 1000);

  socket.on('stop_rest', async () => {
    const getJobId = await saunaQueue.getJob(userId)
    if (getJobId) {
      getJobId.remove()
      removeUserFromRoom(userId)
    }
  });

  addUserToRoom(userId, socket.id, timeToMaxEnergyInMiliSecond);

  socket.emit('server_response', {
    status: Status.SUCCESS,
    message: "Succes connected to sauna",
  });
};

const addUserToRoom = async (userId: string, socketId: string, timeToMaxEnergyInMiliSecond: number) => {
  try {
    const isUserAlreadyInRoom = await isUserInRoom(userId)

    if (isUserAlreadyInRoom) {
      console.log('user already in room', userId);
      return;
    }

    await redisDb.set(`userSocket:${userId}`, socketId)
    await redisDb.set(RedisKey.CONNECTED, Number(await redisDb.get(RedisKey.CONNECTED)) + 1)
    await saunaQueue.add({
      userId,

    }, {
      jobId: userId,
      delay: timeToMaxEnergyInMiliSecond // Delay job execution based on time to max energy
    })

  } catch (e) {
    console.log(e)
  } finally {
    console.log('add user to room finally', userId);
    console.log(await redisDb.get(RedisKey.CONNECTED));
  }
}

const removeUserFromRoom = async (userId: string) => {
  try {
    await redisDb.del(`userSocket:${userId}`)
    await redisDb.set(RedisKey.CONNECTED, Number(await redisDb.get(RedisKey.CONNECTED)) - 1)
  } catch (e) {
    console.log(e)
  } finally {
    console.log('remove user from room finally', userId);
    console.log(await redisDb.get(RedisKey.CONNECTED));
  }
}

const isUserInRoom = async (userId: string) => {
  try {
    const socketId = await redisDb.get(`userSocket:${userId}`)
    if (socketId) {
      return true
    }
    return false
  } catch (e) {
    console.log(e)
    return false
  }
}


