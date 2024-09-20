import mongoose from "mongoose";
import { Ban } from "../models/ban";

export const BanSchema = new mongoose.Schema<Ban>({
  bandId:{
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  userId:{
    type: String,
    required: true
  },
  banType:{
    type: String,
    required: true
  },
  startDate:Date,
  endDate:Date,
  reason:String,
  adminId:String,
  status:{
    type: String,
    required: true
  },
  createdAt:{
    type: Date,
    required: true
  },
  updatedAt:{
    type: Date,
    required: true
  }
})