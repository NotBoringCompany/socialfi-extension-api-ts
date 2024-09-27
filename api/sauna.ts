import { Socket } from "socket.io";
import { SAUNA_LIST } from "../utils/constants/sauna";

export const startRest = (socket:Socket, data:string) =>{
  console.log('new user start rest', data)
  SAUNA_LIST.userConnected += 1
  SAUNA_LIST.userDetail.push({userId: data, timestamp: Math.floor(Date.now() / 1000)})
  socket.emit('server_response', SAUNA_LIST)
}