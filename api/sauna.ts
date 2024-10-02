import { Socket } from "socket.io";
import { EventSauna, SaunaUserDetail } from "../models/sauna";
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
// todo : save this to redis

export const startRest = async (socket: Socket, data: SaunaUserDetail) => {
  try {
    const { userId } = data;
    const user = DUMMY_DATA.find((user) => user.id === userId);

    // Avoid if user not found
    if (!user) {
      return socket.emit('server_response', {
        status: Status.BAD_REQUEST,
        message: "user not found"
      });
    }

    // Avoid if user already full of energy
    if (user.inGameData.energy.currentEnergy === user.inGameData.energy.maxEnergy) {
      return socket.emit('server_response', {
        status: Status.BAD_REQUEST,
        message: "user has max energy"
      });
    }

    const currentEnergy = user.inGameData.energy.currentEnergy;
    const maxEnergy = user.inGameData.energy.maxEnergy;
    const percentage = maxEnergy * 0.2;
    const energyPotionPerSecond = percentage / 60;
    const lack = Math.abs(maxEnergy - currentEnergy);
    const timeToMaxEnergy = lack / energyPotionPerSecond;
    const timeToMaxEnergyInMiliSecond = timeToMaxEnergy * 1000;

    console.log('time to max energy', (timeToMaxEnergyInMiliSecond / 60) / 1000);

    await addUserToRoom(userId, socket.id, timeToMaxEnergyInMiliSecond, lack);
    const getConnected = await redisDb.get(RedisKey.CONNECTED)
    socket.emit(EventSauna.USER_COUNT, getConnected);
    socket.emit(`complete_rest:${userId}`, timeToMaxEnergyInMiliSecond);
  } catch (error) {
    console.log(`(startRest) ${error.message}`);
  }
};

export const stopRest = async (socket: Socket, data: SaunaUserDetail) => {
  try {
    const { userId } = data;
    await removeUserFromRoom(userId);
    const getConnected = await redisDb.get(RedisKey.CONNECTED)
    socket.emit(EventSauna.USER_COUNT, getConnected);
    socket.emit(`complete_rest:${userId}`, 0);
  } catch (error) {
    console.log(`(stopRest) ${error.message}`);
  }
};

/**
 * Add user to room and set delay to queue
 * @param userId user id
 * @param socketId socket id
 * @param timeToMaxEnergyInMiliSecond time to max energy in milisecond
 * @param getTotalEnergy total energy to add
 */
const addUserToRoom = async (userId: string, socketId: string, timeToMaxEnergyInMiliSecond: number, getTotalEnergy: number) => {
  // get user already in room
  const isUserAlreadyInRoom = await isUserInRoom(userId)
  // throw error if user already in room
  if (isUserAlreadyInRoom) throw new Error('User already in room')
  // get total connected
  const userConnected = await redisDb.get(RedisKey.CONNECTED)
  //redis multi set
  const redisMulti = redisDb.multi()
  try {
    // pin user to room
    redisMulti.set(`userSocket:${userId}`, socketId)
    // increment total connected
    redisMulti.set(RedisKey.CONNECTED, Number(userConnected) + 1)
    // add user to queue and set delay
    await saunaQueue.add(
      { userId, socketId, getTotalEnergy },
      { jobId: userId, delay: timeToMaxEnergyInMiliSecond, removeOnComplete: true }
    )
    // exectute redis multi
    await redisMulti.exec()
  } catch (error) {
    throw new Error(`${error.message}`)
  }
}

/**
 * Remove user from room
 * @param userId user id
 */
const removeUserFromRoom = async (userId: string) => {
  // user exist in room
  const isUserExistInRoom = await isUserInRoom(userId)
  // throw error if user not in room
  if (!isUserExistInRoom) throw new Error('User not in room')
  // get total connected
  const userConnected = await redisDb.get(RedisKey.CONNECTED)
  // redis multi set
  const redisMulti = redisDb.multi()
  try {
    // decrement total connected
    redisMulti.set(RedisKey.CONNECTED, Number(userConnected) - 1)
    // remove user from room
    redisMulti.del(`userSocket:${userId}`)
    // exect redis multi
    await redisMulti.exec()
  } catch (error) {
    throw new Error(`${error.message}`)
  }
}

const isUserInRoom = async (userId: string) => {
  // check if user already in room
  const socketId = await redisDb.get(`userSocket:${userId}`)
  // if user not in room return false
  if (!socketId) return false
  // if user in room return true
  return true
}


