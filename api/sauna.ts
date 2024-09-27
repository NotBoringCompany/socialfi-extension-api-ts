import { Socket } from "socket.io";
import { SAUNA_LIST } from "../utils/constants/sauna";
import { SaunaUserDetail } from "../models/sauna";

export const startRest = (socket:Socket, data:SaunaUserDetail) =>{
  console.log('new user start rest', data)
  const {userId} =data;
  // avoid same user id in the list
  if (SAUNA_LIST.userDetail.find((user) => user.userId === userId)) {
    return
  }
  SAUNA_LIST.userConnected += 1
  SAUNA_LIST.userDetail.push({userId: userId, timestamp: Math.floor(Date.now() / 1000)})

  socket.emit('server_response', SAUNA_LIST)
}