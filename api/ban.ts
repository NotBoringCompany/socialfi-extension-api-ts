import { BanStatus, BanType } from "../models/ban"

// ban service 
export const getBans = async () => {}
export const getBanById = async (banId: string) => {}
export const getBanByUserId = async (userId:string) => {}
export const addBan = async (userId:string, banType:BanType, startDate?:Date, endDate?:Date, reason?:string, adminId?:string, status?:BanStatus) => {}
export const updateBan = async (banId:string, banType:BanType, startDate?:Date, endDate?:Date, reason?:string, adminId?:string, status?:BanStatus) => {}