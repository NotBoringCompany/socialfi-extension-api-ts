import {  Ban, BanStatus, BanType } from "../models/ban"
import { BanModel } from "../utils/constants/db";
import { ReturnValue, Status } from "../utils/retVal"
// const DUMMY_BAN: Ban = {
//   adminId: "",
//   bandId: "",
//   banType: BanType.TEMPORARY,
//   createdAt: new Date(),
//   endDate: new Date(),
//   reason: "",
//   status: BanStatus.ACTIVE,
//   startDate: new Date(),
//   updatedAt: new Date(),
//   userId: "",
// }

// ban service 
export const getBans = async (): Promise<ReturnValue<Ban[]>> => {
  try {
    const banList = await BanModel.find().lean();
    return {
      status: Status.SUCCESS,
      message: "success",
      data: banList
    }
  } catch (err: any) {
    return {
      status: 500,
      message: err.message
    }
  }
}
export const getBanById = async (banId: string): Promise<ReturnValue<Ban>> => {
  try {
    const ban = await BanModel.findOne({ banId }).lean();
    return {
      status: 200,
      message: "success",
      data: ban
    }
  } catch (err: any) {
    return {
      status: 500,
      message: err.message
    }
  }
}
export const getBanByUserId = async (userId: string): Promise<ReturnValue<Ban>> => {
  try {
    const ban = await BanModel.findOne({ userId }).lean();
    return {
      status: 200,
      message: "success",
      data: ban
    }
  } catch (err: any) {
    return {
      status: 500,
      message: err.message
    }
  }
}
export const addBan = async (userId: string, banType: BanType, startDate?: Date, endDate?: Date, reason?: string, adminId?: string, status?: BanStatus): Promise<ReturnValue> => {
 try {
    const newBan = new BanModel({
      userId,
      banType,
      startDate,
      endDate,
      reason,
      adminId,
      status
    })
    await newBan.save();
    return {
      status: 200,
      message: "success",
    }
  } catch (err: any) {
    return {
      status: 500,
      message: err.message
    }
  }
}
export const updateBan = async (banId: string, banType: BanType, startDate?: Date, endDate?: Date, reason?: string, adminId?: string, status?: BanStatus): Promise<ReturnValue> => {
  try {
    const ban = await BanModel.findOneAndUpdate({ banId }, {
      banType,
      startDate,
      endDate,
      reason,
      adminId,
      status
    }, { new: true });
    return {
      status: 200,
      message: "success",
    }
  } catch (err: any) {
    return {
      status: 500,
      message: err.message
    }
  }
}