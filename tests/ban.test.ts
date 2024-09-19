import request from 'supertest'
import app from '../server'
import { addBan, getBanById, getBanByUserId, getBans, updateBan } from '../api/ban';
import { verifyToken } from '../api/auth';
import { Ban, BanStatus, BanType } from '../models/ban';
import jwt from 'jsonwebtoken';
import { Status } from '../utils/retVal';
jest.mock('../api/ban');
jest.mock('../api/auth');

const mockAddBan = addBan as jest.MockedFunction<typeof addBan>;
const mockUpdateBan = updateBan as jest.MockedFunction<typeof updateBan>;

const mockBanList = getBans as jest.MockedFunction<typeof getBans>;
const mockBanId = getBanById as jest.MockedFunction<typeof getBanById>;
const mockBanByUserId = getBanByUserId as jest.MockedFunction<typeof getBanByUserId>;

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const validToken = jwt.sign(
  { userId: '123', role: 3 },
  process.env.JWT_SECRET!,
  { expiresIn: '1h' }
);
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
  //@ts-ignore
  id: "1"
}
const mockBans: Ban[] = new Array(3).fill(null).map((_, i) => ({
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

describe('Ban unit test', () => {

  describe('POST /bans', () => {
    // test only admin permission
    it('should error when no token', async () => {
      mockAddBan.mockResolvedValueOnce({ status: 200, message: "success", data: mockBan })
      const response = await request(app).post('/bans').send({
        userId: "test",
      })
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ status: 401, message: "(verifyToken) No token provided" })
    }, 100000);

    it('should error when invalid format', async () => {
      mockAddBan.mockResolvedValueOnce({ status: 200, message: "success", data: mockBan })
      const response = await request(app).post('/bans').set('Authorization', 'testtoken').send({
        userId: "test",
      })
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ status: 401, message: "(verifyToken) Invalid token format" })
    }, 30000);

    it('should add ban with admin permission', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        status: Status.SUCCESS,
        message: 'Token valid',
        data: { id: '123', role: 3, name: "admin", method: "POST", username: "admin" },
      });

      mockAddBan.mockResolvedValueOnce({ status: 200, message: "success", data: mockBan })
      const response = await request(app).post('/bans').set('Authorization', `Bearer ${validToken}`).send({
        userId: "test",
      })

      const expectedData = {
        ...mockBan,
        createdAt: mockBan.createdAt.toISOString(),
        endDate: mockBan.endDate.toISOString(),
        startDate: mockBan.startDate.toISOString(),
        updatedAt: mockBan.updatedAt.toISOString(),
      };

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 200, message: "success", data: expectedData })
    })
  })

  // test get endpoint
  describe('GET /bans', () => {
    it('should return banned list', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        status: Status.SUCCESS,
        message: 'Token valid',
        data: { id: '123', role: 3, name: "admin", method: "get", username: "admin" },
      });

      mockBanList.mockResolvedValueOnce({ status: 200, message: "success", data: mockBans })
      const response = await request(app).get('/bans').set(
        'Authorization', `Bearer ${validToken}`
      )

      const expectedData = mockBans.map((ban) => ({
        ...ban,
        createdAt: ban.createdAt.toISOString(),
        endDate: ban.endDate.toISOString(),
        startDate: ban.startDate.toISOString(),
        updatedAt: ban.updatedAt.toISOString(),
      }));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 200, message: "success", data: expectedData })
    });

    it('should return band by id', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        status: Status.SUCCESS,
        message: 'Token valid',
        data: { id: '123', role: 3, name: "admin", method: "get", username: "admin" },
      });

      mockBanId.mockResolvedValueOnce({ status: 200, message: "success", data: mockBan })
      const response = await request(app).get('/bans/1').set(
        'Authorization', `Bearer ${validToken}`
      )

      const expectedData = {
        ...mockBan,
        createdAt: mockBan.createdAt.toISOString(),
        endDate: mockBan.endDate.toISOString(),
        startDate: mockBan.startDate.toISOString(),
        updatedAt: mockBan.updatedAt.toISOString(),
      };
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 200, message: "success", data: expectedData })
    });

    it('should return status when user already banned', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        status: Status.SUCCESS,
        message: 'Token valid',
        data: { id: '123', role: 1, name: "user", method: "get", username: "user" },
      });

      mockBanByUserId.mockResolvedValueOnce({ status: 200, message: "success", data: mockBan })
      const response = await request(app).get('/bans/user/test').set(
        'Authorization', `Bearer ${validToken}`
      )

      const expectedData = {
        ...mockBan,
        createdAt: mockBan.createdAt.toISOString(),
        endDate: mockBan.endDate.toISOString(),
        startDate: mockBan.startDate.toISOString(),
        updatedAt: mockBan.updatedAt.toISOString(),
      };

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 200, message: "success", data: expectedData })
    })
  })

  // todo admin test update user ban status (active, expired, revoked)
  describe('PATCH /bans', () => {
    it('should update ban status from active to expired', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        status: Status.SUCCESS,
        message: 'Token valid',
        data: { id: '123', role: 3, name: "admin", method: "patch", username: "admin" },
      });

      mockAddBan.mockResolvedValueOnce({ status: 200, message: "success", data: mockBan });
      const addBanResponse = await request(app).post('/bans').set('Authorization', `Bearer ${validToken}`).send({
        userId: "test",
      })

      const expectedAddData = {
        ...mockBan,
        createdAt: mockBan.createdAt.toISOString(),
        endDate: mockBan.endDate.toISOString(),
        startDate: mockBan.startDate.toISOString(),
        updatedAt: mockBan.updatedAt.toISOString(),
      };

      expect(addBanResponse.status).toBe(200);
      expect(addBanResponse.body).toEqual({ status: 200, message: "success", data: expectedAddData });
      expect(addBanResponse.body.data.status).toBe(BanStatus.ACTIVE);

      const updateMockBan = {
        ...mockBan,
        createdAt: mockBan.createdAt.toISOString(),
        endDate: mockBan.endDate.toISOString(),
        startDate: mockBan.startDate.toISOString(),
        updatedAt: mockBan.updatedAt.toISOString(),
        status: BanStatus.EXPIRED
      }

      mockVerifyToken.mockResolvedValueOnce({
        status: Status.SUCCESS,
        message: 'Token valid',
        data: { id: '123', role: 3, name: "admin", method: "patch", username: "admin" },
      });

      mockUpdateBan.mockResolvedValueOnce({ status: 200, message: "success", data: updateMockBan });
      const updateBanResponse = await request(app).patch(`/bans/${addBanResponse.body.data.id}`).set('Authorization', `Bearer ${validToken}`).send({
        status: BanStatus.EXPIRED
      })

      expect(updateBanResponse.status).toBe(200);
      expect(updateBanResponse.body).toEqual({ status: 200, message: "success", data: updateMockBan });
    })
  })
})