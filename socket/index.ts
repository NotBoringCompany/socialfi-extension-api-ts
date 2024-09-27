import { Socket } from "socket.io";
import { startRest } from "../api/sauna";

export const socketHandler = (socket:Socket) => {
  console.log('a user connected');

  socket.on("start_rest", (msg)=>{
      startRest(socket, msg)
  })
  
  socket.on('disconnect', () => {
      console.log('user disconnected');
  });
}