import request from 'supertest'
import app from '../server'
import { getBans } from '../api/ban'
import { Ban, BanStatus, BanType } from '../models/ban';
jest.mock('../api/ban');

const mockBanList = getBans as jest.MockedFunction<typeof getBans>;

describe('Ban', () => {
  it('should return banned list', async () => {
   const mockBan:Ban = {
    adminId: "1",
    bandId: "1",
    banType: BanType.TEMPORARY,
    createdAt: new Date(),
    endDate: new Date(),
    reason: "test",
    status: BanStatus.ACTIVE,
    startDate: new Date(),
    updatedAt: new Date(),
    userId: "1",
   }
   mockBanList.mockResolvedValueOnce({status: 200, message: "success", data: [mockBan]})
    const response = await getBans();
    expect(response.status).toBe(200);
    expect(response.data).toEqual([mockBan]);
  });
})