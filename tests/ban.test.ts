import request from 'supertest'
import app from '../server'
import { addBan, getBanById, getBans } from '../api/ban'
import { verifyToken } from '../api/auth'
import { Ban, BanStatus, BanType } from '../models/ban';
import { ReturnValue, Status } from '../utils/retVal';
import { generateJWT, validateJWT } from '../utils/jwt';
import passport from 'passport';
import { handleTwitterLogin } from '../api/user';
jest.mock('../api/ban');
jest.mock('../utils/jwt');
jest.mock('../api/user');
jest.mock('../configs/passport');
jest.mock('passport');

const mockBanList = getBans as jest.MockedFunction<typeof getBans>;
const mockBanId = getBanById as jest.MockedFunction<typeof getBanById>;
const mockAddBand = addBan as jest.MockedFunction<typeof addBan>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockValidateJWT = validateJWT as jest.MockedFunction<typeof validateJWT>;
const mockGenerateJWT = generateJWT as jest.MockedFunction<typeof generateJWT>;
const mockHandleTwitterLogin = handleTwitterLogin as jest.MockedFunction<typeof handleTwitterLogin>;

describe('Ban unit test', () => {
  // todo login as admin implement di sini
  // it('should login as admin', async () => {
  //   mockGenerateJWT.mockResolvedValueOnce("test");
  //   const response = await request(app).get('/auth/twitter/login')
  //   expect(response.status).toBe(200);
  // })

  it('should redirect to Twitter for authentication if no token is present', async () => {
    (passport.authenticate as jest.Mock).mockImplementation((strategy, options) => {
      return (req: any, res: any, next: any) => {
        res.redirect('https://twitter.com/oauth/authenticate');
      };
    });

    const response = await request(app).get('/auth/twitter/login');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('https://twitter.com/oauth/authenticate');
  });

  it('should handle Twitter callback and generate a JWT', async () => {
    const mockUser = {
      id: '12345',
      twitterAccessToken: 'mockAccessToken',
      twitterRefreshToken: 'mockRefreshToken',
      twitterExpiryDate: Math.floor(Date.now() / 1000) + 3600,
    };

    // Mock successful Passport authentication
    (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
      return (req: any, res: any, next: any) => {
        req.user = mockUser;
        callback(null, req.user);
      };
    });

    // Mock the Twitter login handler and JWT generation
    mockHandleTwitterLogin.mockResolvedValue({
      status: Status.SUCCESS,
      message: 'Login success',
      data: { ...mockUser, userId: 'mockUserId' }
    });
    mockGenerateJWT.mockReturnValue('mockJwtToken');

    const response = await request(app).get('/auth/twitter/callback');

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('https://x.com?jwt=mockJwtToken');
    expect(mockGenerateJWT).toHaveBeenCalledWith(
      mockUser.id,
      mockUser.twitterAccessToken,
      mockUser.twitterRefreshToken,
      mockUser.twitterExpiryDate - Math.floor(Date.now() / 1000)
    );
  });

  it('should handle Twitter callback error', async () => {
    // Simulate Passport authentication failure
    (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
      return (req: any, res: any, next: any) => {
        callback(new Error('Twitter authentication failed'), null);
      };
    });

    const response = await request(app).get('/auth/twitter/callback');

    expect(response.status).toBe(401);
    expect(response.body.status).toBe(Status.UNAUTHORIZED);
    })

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
    const { status, message, data }: { status: number, message: string, data: Ban } = response.body
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