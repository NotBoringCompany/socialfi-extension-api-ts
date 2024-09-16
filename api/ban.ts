import { BanStatus, BanType } from "../models/ban"
import { ReturnValue } from "../utils/retVal"

// ban service 
export const getBans = async (): Promise<ReturnValue> => {

  return {
    status: 200,
    message: "success",
  }
}
export const getBanById = async (banId: string): Promise<ReturnValue> => {
  return {
    status: 200,
    message: "success",

  }
}
export const getBanByUserId = async (userId: string): Promise<ReturnValue> => {
  return {
    status: 200,
    message: "success",
  }
}
export const addBan = async (userId: string, banType: BanType, startDate?: Date, endDate?: Date, reason?: string, adminId?: string, status?: BanStatus): Promise<ReturnValue> => {
  return {
    status: 200,
    message: "success",

  }
}
export const updateBan = async (banId: string, banType: BanType, startDate?: Date, endDate?: Date, reason?: string, adminId?: string, status?: BanStatus): Promise<ReturnValue> => {
  return {
    status: 200,
    message: "success",
  }
}