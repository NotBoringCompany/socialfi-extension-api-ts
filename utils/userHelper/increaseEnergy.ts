import { User } from "../../models/user";
import { UserModel } from "../constants/db"

// const user:User = {
//   inGameData: {
//     energy:{currentEnergy: 0, maxEnergy: 0, dailyEnergyPotion: 0}
//   }
// }

export const increaseEnergy = async (userId:string, energyToAdd: number) => {
  try {
    const getUser:User = await UserModel.findOne({ _id: userId }).lean();
    if (!getUser) {
      throw new Error("(helper increaseEnergy) User not found");
    }
    await UserModel.updateOne(
      { _id: userId },
      { $inc: { energy: {
        currentEnergy: energyToAdd
      } } }
    );
  } catch (e) {}
}