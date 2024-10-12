import { Socket } from "socket.io";
import { EventSauna, SaunaGlobalKey, SaunaUserDetail } from "../models/sauna";
import { Status } from "../utils/retVal";
import redisDb from "../utils/constants/redisDb";
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

    // setup requirement rest
    const maximumEnergyToFarm = 1000;
    const energyPotionPerMinute = 25;
    const energyPotionPerSecond = energyPotionPerMinute / 60;
    const maxTimeToRest = maximumEnergyToFarm / energyPotionPerMinute; // 40 minute
    const maxTimeToRestInMiliSecond = (maxTimeToRest * 60) * 1000;  // 2400000 mili second

    // setup user time needed energy
    const currentEnergy = user.inGameData.energy.currentEnergy;
    const maxEnergy = user.inGameData.energy.maxEnergy;
    const lack = Math.abs(maxEnergy - currentEnergy);

    // how much user need to rest 
    const timeNeededEnergy = lack / energyPotionPerSecond;
    const timeNeededEnergyInMiliSecond = (timeNeededEnergy * 60) * 1000;

    // rest time 
    const restTime = timeNeededEnergyInMiliSecond > maxTimeToRestInMiliSecond ? maxTimeToRestInMiliSecond : timeNeededEnergyInMiliSecond;
    const startTime = Math.floor(Date.now() / 1000);

    await addUserToRoom(userId, socket.id, energyPotionPerSecond, startTime, maximumEnergyToFarm);
    const getConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
    // emit to all user connected
    socket.broadcast.emit(EventSauna.USER_COUNT, getConnected);
    // emit to user
    socket.emit(EventSauna.USER_COUNT, getConnected);
    return socket.emit('server_response', {
      status: Status.SUCCESS,
      message: `(startRest) user ${userId} has started rest`,
      data: {
        timeToMaxEnergyInMiliSecond: restTime,
        energyPotionPerSecond,
        isStartRest: true,
        startTimestamp: startTime
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
/**
 * @deprecated 
 * @param socket socket
 * @returns 
 */
export const stopRest = async (socket: Socket) => {
  try {
    const userId = await redisDb.get(socket.id);
    const isUserAlreadyInRoom = await isUserInRoom(userId);
    if (!isUserAlreadyInRoom) {
      return socket.emit('server_response', {
        status: Status.BAD_REQUEST,
        message: `(stopRest) user ${userId} is not in room`
      });
    }
    // get user energy potion per second
    const getEnergyPotionPerSecond = await redisDb.get(`energyPotionPerSecond:${userId}`);
    // get user when user join
    const getTimeUserJoin = await redisDb.get(`timeStamp:${userId}`);
    // calculate total energy
    const dateNowInSeconds = Math.floor(Date.now() / 1000);
    // calculate total time rest
    const userGetRestTime = Math.abs(dateNowInSeconds - Number(getTimeUserJoin));
    // calculate total energy
    const getTotalEnergy = Math.floor(userGetRestTime * Number(getEnergyPotionPerSecond));
    // recover energy
    await energyRecover(userId, getTotalEnergy);
    // remove user from room
    await removeUserFromRoom(socket.id);
    const getConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
    // broadcast to all user
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
 * @param energyInSecond time to max energy in second
 * @param startTime start time in milisecond
 * @param maximumEnergy maximum energy of user
 */
const addUserToRoom = async (userId: string, socketId: string, energyInSecond: number, startTime: number, maximumEnergy: number) => {
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
    await removeUserFromRoom(getCurrentSocketId); // Remove old socket
    console.log(`Socket ID updated for user ${userId}`);
  }
  // get total connected
  const userConnected = await redisDb.get(SaunaGlobalKey.CONNECTED)
  // get max energy
  const getMaxEnergy = await redisDb.get(`maximumEnergy:${userId}`)
  //redis multi set
  const redisMulti = redisDb.multi()
  try {
    if (!getMaxEnergy) {
      // set user max energy
      redisMulti.set(`maximumEnergy:${userId}`, maximumEnergy, 'EX', getExpiredTime())
    }
    // pin user to room
    redisMulti.set(`userSocket:${userId}`, socketId)
    // pin user when user connected
    redisMulti.set(`timeStamp:${userId}`, startTime)
    // set user energy potion per second
    redisMulti.set(`energyPotionPerSecond:${userId}`, energyInSecond)
    // pin user to socketid
    redisMulti.set(socketId, userId)
    // increment total connected
    redisMulti.set(SaunaGlobalKey.CONNECTED, Number(userConnected) + 1)
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
    // remove user timestamp
    redisMulti.del(`timeStamp:${userId}`)
    // remove user energy potion per second
    redisMulti.del(`energyPotionPerSecond:${userId}`)
    // remove user from socket
    redisMulti.del(socketId)
    // exectute redis multi
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
      message: `(saunaInit) ${error.message}`,
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

/**
 * Add energy to user's current energy
 * @param userId user id
 * @param energyRecover energy to add
 * @returns Promise of updateOne result
 */
export const energyRecover = async (userId: string, energyRecover: number): Promise<any> => {
  try {
    // check if user already in room
    const isUserExistInRoom = await isUserInRoom(userId)
    if (!isUserExistInRoom) throw new Error('User not in room')

    // check user exist
    const user = await UserModel.findOne({ _id: userId })
    if (!user) throw new Error('User not found')

    // get user max energy can recover
    const remainingEnergy = await redisDb.get(`maximumEnergy:${userId}`)
    if (!remainingEnergy) throw new Error('no remaining energy')
    if (Number(remainingEnergy) < energyRecover) throw new Error('no remaining energy')

    // update remaining energy
    await redisDb.set(`maximumEnergy:${userId}`, Number(remainingEnergy) - energyRecover)

    // check if energy to greater than max energy set it to max energy
    if (user.inGameData.energy.currentEnergy + energyRecover > user.inGameData.energy.maxEnergy) {
      return await UserModel.updateOne(
        { _id: userId },
        { $set: { 'inGameData.energy.currentEnergy': user.inGameData.energy.maxEnergy } }
      )
    }

    // update user energy
    return await UserModel.updateOne(
      { _id: userId },
      { $inc: { 'inGameData.energy.currentEnergy': energyRecover } }
    )
  } catch (error) {
    throw new Error(`${error.message}`)
  }
}

// the function return expired time until midnight
const getExpiredTime = () => {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const timeUntilMidnight = midnight.getTime() - now.getTime();
  return Math.floor(timeUntilMidnight / 1000);
}