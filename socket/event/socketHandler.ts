import { Socket } from "socket.io";
import { energyRecover, saunaInit, startRest, stopRest } from "../../api/sauna";
import { Status } from "../../utils/retVal";

export const socketHandler = (socket: Socket) => {
  saunaInit(socket);

  socket.on("start_rest", (msg) => {
    startRest(socket, msg)
  })

  socket.on("alive", async (msg) => {
    const {socketId, getTotalEnergy, userId, message} = msg;
    console.log(`user ${userId} yep!!!`);
    await energyRecover(userId, getTotalEnergy);
    socket.emit("server_response", {
      status: Status.SUCCESS,
      message: "Energy recovered successfully"
    })
  })

  socket.on('disconnect', () => {
    stopRest(socket);
  });
}