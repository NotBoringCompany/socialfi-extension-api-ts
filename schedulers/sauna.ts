import Bull from "bull";

export const saunaQueue = new Bull('saunaQueue', {
  redis: process.env.REDIS_URL
});

saunaQueue.process(async (job) => {
  const { userId } = job.data;
  console.log('saunaQueue', userId);
  // const user = DUMMY_DATA.find((user) => user.id === userId);

  // if (user) {
  //   user.inGameData.energy.currentEnergy = user.inGameData.energy.maxEnergy;
  //   const getUserSocket = await redisDb.get(`userSocket:${userId}`);
  //   const userSocket:Socket = JSON.parse(getUserSocket);
  //   if (userSocket) {
  //     userSocket.emit('server_response', {
  //       message: `Energy fully recovered for user ${userId}`,
  //       user
  //     });
  //   }
  // }
});