import { Socket } from "socket.io";
import { EventSauna, SaunaGlobalKey, SaunaUserDetail } from "../models/sauna";
import { Status } from "../utils/retVal";
import redisDb from "../utils/constants/redisDb";
import { saunaQueue } from "../schedulers/sauna";
import { UserModel } from "../utils/constants/db";


export const startRest = async (socket: Socket, data: SaunaUserDetail) => {
  try {
    const { userId } = data;
    const user = await UserModel.findOne({ _id: userId }).lean();
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
    const percentage = maxEnergy * 0.1;
    const energyPotionPerSecond = percentage / 60;
    const lack = Math.abs(maxEnergy - currentEnergy);
    const timeToMaxEnergy = lack / energyPotionPerSecond;
    const timeToMaxEnergyInMiliSecond = timeToMaxEnergy * 1000;

    console.log('time to max energy', (timeToMaxEnergyInMiliSecond / 60) / 1000);

    await addUserToRoom(userId, socket.id, timeToMaxEnergyInMiliSecond, lack);
    const getConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
    socket.broadcast.emit(EventSauna.USER_COUNT, getConnected);
    socket.emit(EventSauna.USER_COUNT, getConnected);
    return socket.emit('server_response', {
      status: Status.SUCCESS,
      message: `(startRest) user ${userId} has started rest`,
      data: {
        timeToMaxEnergyInMiliSecond
      }
    });
  } catch (error) {
    console.log(error.message);
    return socket.emit('server_response', {
      status: Status.BAD_REQUEST,
      message: `(startRest) ${error.message}`
    });
  }
};

export const stopRest = async (socket: Socket) => {
  try {
    const userId = await redisDb.get(socket.id);
    await removeUserFromRoom(socket.id);
    const getConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
    socket.broadcast.emit(EventSauna.USER_COUNT, getConnected);
    socket.emit(EventSauna.USER_COUNT, getConnected);
    return socket.emit('server_response', {
      status: Status.SUCCESS,
      message: `(stopRest) user ${userId} has stopped rest`
    });
  } catch (error) {
    return socket.emit('server_response', {
      status: Status.BAD_REQUEST,
      message: `(stopRest) ${error.message}`
    });
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
  // socket id same as user id
  const getCurrentSocketId = await redisDb.get(`userSocket:${userId}`)
  const isSocketIdSameAsUserId = getCurrentSocketId === socketId
  // user already in room 
  if (isUserAlreadyInRoom && isSocketIdSameAsUserId) {
    throw new Error('user already in room');
  }
  // if user already in room but socket different, remove old socket and set new socket
  if (isUserAlreadyInRoom && !isSocketIdSameAsUserId) {
    await removeUserFromRoom(getCurrentSocketId); // Remove socket yang lama
    console.log(`Socket ID updated for user ${userId}`);
  }
  // get total connected
  const userConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
  //redis multi set
  const redisMulti = redisDb.multi()
  try {
    // pin user to room
    redisMulti.set(`userSocket:${userId}`, socketId)
    // pin user to socketId
    redisMulti.set(socketId, userId)
    // increment total connected
    redisMulti.set(SaunaGlobalKey.CONNECTED, Number(userConnected) + 1)
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
const removeUserFromRoom = async (socketId: string) => {
  // get userId from socket id
  const userId = await redisDb.get(socketId)
  // user exist in room
  const isUserExistInRoom = await isUserInRoom(userId)
  // throw error if user not in room
  if (!isUserExistInRoom) throw new Error('User not in room')
  // get total connected
  const userConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
  // redis multi set
  const redisMulti = redisDb.multi()
  try {
    // decrement total connected
    redisMulti.set(SaunaGlobalKey.CONNECTED, Number(userConnected) - 1)
    // remove user from room
    redisMulti.del(`userSocket:${userId}`)
    // remove user from socket
    redisMulti.del(socketId)
    // exect redis multi
    const currentJob = await saunaQueue.getJob(userId)
    if (currentJob) await currentJob.remove()
    await redisMulti.exec()
  } catch (error) {
    throw new Error(`${error.message}`)
  }
}

export const saunaInit = async (socket: Socket) => {
  try {
    const userConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
    socket.broadcast.emit(EventSauna.USER_COUNT, userConnected ? Number(userConnected) : 0)
    socket.emit(EventSauna.USER_COUNT, userConnected ? Number(userConnected) : 0)
  } catch (error) {
    socket.emit('server_response', {
      status: Status.ERROR,
      message: `(saunaInit) ${error.message}`
    })
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

export const energyRecover = async (userId: string, energyRecover: number) => {
  try {
    const isUserExistInRoom = await isUserInRoom(userId)
    if (!isUserExistInRoom) throw new Error('User not in room')

    const isUserExist = await UserModel.exists({ _id: userId })
    if (!isUserExist) throw new Error('User not found')

    await UserModel.updateOne(
      { _id: userId },
      { $inc: { 'inGameData.energy.currentEnergy': energyRecover } }
    )
  } catch (error) {
    throw new Error(`${error.message}`)
  }
}
