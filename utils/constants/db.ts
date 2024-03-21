import mongoose from 'mongoose';
import { UserSchema } from '../../schemas/User';
import { BitSchema } from '../../schemas/Bit';
import { IslandSchema } from '../../schemas/Island';
import { RaftSchema } from '../../schemas/Raft';

export const UserModel = mongoose.model('Users', UserSchema, 'Users');
export const BitModel = mongoose.model('Bits', BitSchema, 'Bits');
export const IslandModel = mongoose.model('Islands', IslandSchema, 'Islands');
export const RaftModel = mongoose.model('Rafts', RaftSchema, 'Rafts');