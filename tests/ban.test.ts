import request from 'supertest'
import app from '../server'
import { addBan, getBanById, getBans } from '../api/ban'
import { Ban, BanStatus, BanType } from '../models/ban';
import { ReturnValue, Status } from '../utils/retVal';
jest.mock('../api/ban');

const mockBanList = getBans as jest.MockedFunction<typeof getBans>;
const mockBanId = getBanById as jest.MockedFunction<typeof getBanById>;
const mockAddBand = addBan as jest.MockedFunction<typeof addBan>;

jest.setTimeout(30000); // Set timeout menjadi 30 detik
describe('Ban unit test', () => {

  it('should add ban by userid', async () => {
    const mockBan: Ban = {
      adminId: "123",
      bandId: "1",
      banType: BanType.TEMPORARY,
      createdAt: new Date(),
      endDate: new Date(),
      reason: "test",
      status: BanStatus.ACTIVE,
      startDate: new Date(),
      updatedAt: new Date(),
      userId: "test",
    }
    mockAddBand.mockResolvedValueOnce({ status: 200, message: "success", data: mockBan })
    const response = await request(app).post('/bans').send({
      userId: "test",
    })
    expect(response.status).toBe(200);
    const { status, message, data }:{status: number, message: string, data: Ban} = response.body
    expect(data.status).toEqual(mockBan.status)
  });

  it('should return banned list', async () => {
    const mockBan: Ban[] = new Array(3).fill(null).map((_, i) => ({
      adminId: "123",
      bandId: i.toString(),
      banType: BanType.TEMPORARY,
      createdAt: new Date(),
      endDate: new Date(),
      reason: "test",
      status: BanStatus.ACTIVE,
      startDate: new Date(),
      updatedAt: new Date(),
      userId: i + 'test',
    }))
    mockBanList.mockResolvedValueOnce({ status: 200, message: "success", data: mockBan })
    const response = await request(app).get('/bans')
    expect(response.status).toBe(200);
    const { status, message, data } = response.body
    const check: Ban[] = data
    expect(check.every((ban, i) => ban.status === mockBan[i].status)).toEqual(true);
  });

  it('should return band by id', async () => {
    const mockBan: Ban = {
      adminId: "123",
      bandId: "1",
      banType: BanType.TEMPORARY,
      createdAt: new Date(),
      endDate: new Date(),
      reason: "test",
      status: BanStatus.ACTIVE,
      startDate: new Date(),
      updatedAt: new Date(),
      userId: "test",
    }
    mockBanId.mockResolvedValueOnce({ status: 200, message: "success", data: mockBan })
    const response = await request(app).get('/bans/1')
    expect(response.status).toBe(200);
    const { data } = response.body
    expect(data.status).toEqual(mockBan.status);
  });
})