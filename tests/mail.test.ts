import app from '../server';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import { Status } from '../utils/retVal';
import { MailSchema } from '../schemas/Mail';
import { UserSchema } from '../schemas/User';
import { mailTransformHelper } from '../utils/mail';
import { validateRequestAuth } from '../utils/auth';
import { Mail, MailDTO, MailType } from '../models/mail';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  getAllMailsByUserIdWithPagination, readMail, claimMail,
  deleteMail, readAllMails, claimAllMails, deletedAllMails
} from '../api/mail';

jest.mock('../api/mail');
jest.mock('../utils/auth');

const mockGetAllMailsByUserIdWithPagination = getAllMailsByUserIdWithPagination as jest.MockedFunction<typeof getAllMailsByUserIdWithPagination>;
const mockValidateRequestAuth = validateRequestAuth as jest.MockedFunction<typeof validateRequestAuth>;
const mockReadMail = readMail as jest.MockedFunction<typeof readMail>;
const mockClaimMail = claimMail as jest.MockedFunction<typeof claimMail>;
const mockDeleteMail = deleteMail as jest.MockedFunction<typeof deleteMail>;
const validToken = jwt.sign(
  { twiterId: '123' },
  process.env.JWT_SECRET!,
  { expiresIn: '1h' }
)

let mongoServer: MongoMemoryServer = null as any;
let MailModel: mongoose.Model<Mail> = null as any;
let UserModel: mongoose.Model<any> = null as any;

describe('Mail unit test', () => {
  // setup database
  beforeAll(async () => {
    // define mongo server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    // define models
    MailModel = mongoose.model('Mail', MailSchema, 'Mail');
    UserModel = mongoose.model('User', UserSchema, 'User');

    const createUser = new UserModel({
      createdTimestamp: 0,
      inGameData: {},
      inventory: [],
      twitterId: `twitter123`,
      twitterUsername: "test",
      userId: `userId123`,
      discordProfile: {},
      inviteCodeData: {},
      openedTweetIdsToday: [],
    })
    await createUser.save()

    const getUsers = await UserModel.find().lean();
    // transform users into mailStatus setup
    const setupUsers = getUsers.map((user) => {
      return {
        _id: user._id,
        isRead: {
          status: false,
          timestamp: 0
        },
        isClaimed: {
          status: false,
          timestamp: 0
        },
        isDeleted: {
          status: false,
          timestamp: 0
        }
      }
    })
    // setup mail
    const createMail = new MailModel({
      body: "test",
      attachments: [],
      expiredDate: 0,
      receiverIds: setupUsers,
      subject: "test",
      timestamp: 0,
      type: MailType.NOTICES
    })
    await createMail.save()
  });

  // Disconnect and stop MongoMemoryServer after all tests
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('should create new mail in database', async () => {
    const foundMail = await MailModel.find().lean();
    expect(foundMail.length).toBe(1);
    expect(foundMail[0].receiverIds.length).toBe(1);
    expect(foundMail[0].subject).toBe("test");
  });
  describe('GET Mail', () => {
    it('should get all mails by user id with pagination', async () => {
      /**
       * the implementation close with how to mail should be processed
       */
      const getUsers = await UserModel.find().lean();
      const userId = getUsers[0]._id;
      // setup pagination
      const page = 1;
      const limit = 10;
      const totalMail = await MailModel.countDocuments({ receiverIds: { $elemMatch: { _id: userId } } });
      const totalPage = Math.ceil(totalMail / limit);
      const isHasNext = totalPage > page;

      const getMockMail = await MailModel.find({
        receiverIds: { $elemMatch: { _id: userId } }
      }).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean();
      const transformData = mailTransformHelper(getMockMail, userId as string);
      // setup validation 
      mockValidateRequestAuth.mockResolvedValueOnce({
        status: Status.SUCCESS,
        message: 'Token Valid',
        data: {
          twiterId: '123'
        }
      })
      // setup mock  if success to get mails
      mockGetAllMailsByUserIdWithPagination.mockResolvedValueOnce({
        status: Status.SUCCESS,
        message: '(getAllMailsByUserIdWithPagination) Successfully retrieved mails',
        data: transformData,
        meta: {
          currentPage: page,
          pageSize: limit,
          totalPage: totalPage,
          totalItems: totalMail,
          isHasNext: isHasNext
        }
      })

      const response = await request(app).get(`/mail/get_mails/${userId}?page=${page}&limit=${limit}`).set('Authorization', `Bearer ${validToken}`)
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        status: Status.SUCCESS,
        message: '(getAllMailsByUserIdWithPagination) Successfully retrieved mails',
        data: transformData,
        meta: {
          currentPage: page,
          pageSize: limit,
          totalPage: totalPage,
          totalItems: totalMail,
          isHasNext: isHasNext
        }
      })

    })
  })

  describe('POST Mail', () => {
    describe('Read Mail', () => {
      it('should read mail by user id', async () => {
        mockValidateRequestAuth.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: 'Token Valid',
          data: {
            twiterId: '123'
          }
        })
        mockReadMail.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: '(readMail) Successfully updated mail status'
        })
        const response = await request(app).post('/mail/read_mail').set('Authorization', `Bearer ${validToken}`).send({
          mailId: '1',
          userId: '123'
        })
        expect(response.status).toBe(200)
        expect(response.body).toEqual({
          status: Status.SUCCESS,
          message: '(readMail) Successfully updated mail status'
        })
      })

      it('should error read if not send mailid and userid', async () => {
        mockValidateRequestAuth.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: 'Token Valid',
          data: {
            twiterId: '123'
          }
        })
        const response = await request(app).post('/mail/read_mail').set('Authorization', `Bearer ${validToken}`).send({})
        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          status: Status.BAD_REQUEST,
          message: '(readMail) Error: mailId and userId are required'
        })
      })

      it('should error if try to read mail (update) but data does not exist', async () => {
        mockValidateRequestAuth.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: 'Token Valid',
          data: {
            twiterId: '123'
          }
        })
        const response = await request(app).post('/mail/read_mail').set('Authorization', `Bearer ${validToken}`).send({
          mailId: '1',
          userId: '123'
        })
        expect(response.status).toBe(500)
        expect(response.body).toEqual({
          status: Status.ERROR,
          message: "(readMail) Error: Cannot destructure property 'status' of '(intermediate value)' as it is undefined."
        })
      })
    })

    describe('Delete Mail', () => {
      it('should delete mail by user id', async () => {
        mockValidateRequestAuth.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: 'Token Valid',
          data: {
            twiterId: '123'
          }
        })
        mockDeleteMail.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: '(deleteMail) Successfully deleted mail'
        })
        const response = await request(app).post('/mail/delete_mail').set('Authorization', `Bearer ${validToken}`).send({
          mailId: '1',
          userId: '123'
        })
        expect(response.status).toBe(200)
        expect(response.body).toEqual({
          status: Status.SUCCESS,
          message: '(deleteMail) Successfully deleted mail'
        })
      })

      it('should error delete if not send mailid and userid', async () => {
        mockValidateRequestAuth.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: 'Token Valid',
          data: {
            twiterId: '123'
          }
        })
        const response = await request(app).post('/mail/delete_mail').set('Authorization', `Bearer ${validToken}`).send({})
        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          status: Status.BAD_REQUEST,
          message: '(deleteMail) Error: mailId and userId are required'
        })
      })

      it('should error if try to delete mail (update) but data does not exist', async () => {
        mockValidateRequestAuth.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: 'Token Valid',
          data: {
            twiterId: '123'
          }
        })
        const response = await request(app).post('/mail/delete_mail').set('Authorization', `Bearer ${validToken}`).send({
          mailId: '1',
          userId: '123'
        })
        expect(response.status).toBe(500)
        expect(response.body).toEqual({
          status: Status.ERROR,
          message: "(deleteMail) Error: Cannot destructure property 'status' of '(intermediate value)' as it is undefined."
        })
      })
    })

    describe('Claim Mail', () => {
      it('should claim mail by user id', async () => {
        mockValidateRequestAuth.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: 'Token Valid',
          data: {
            twiterId: '123'
          }
        })
        mockClaimMail.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: '(claimMail) Successfully claimed mail'
        })
        const response = await request(app).post('/mail/claim_mail').set('Authorization', `Bearer ${validToken}`).send({
          mailId: '1',
          userId: '123'
        })
        expect(response.status).toBe(200)
        expect(response.body).toEqual({
          status: Status.SUCCESS,
          message: '(claimMail) Successfully claimed mail'
        })
      })

      it('should error claim if not send mailid and userid', async () => {
        mockValidateRequestAuth.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: 'Token Valid',
          data: {
            twiterId: '123'
          }
        })
        const response = await request(app).post('/mail/claim_mail').set('Authorization', `Bearer ${validToken}`).send({})
        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          status: Status.BAD_REQUEST,
          message: '(claimMail) Error: mailId and userId are required'
        })
      })
      
      it('should error if try to claim mail (update) but data does not exist', async () => {
        mockValidateRequestAuth.mockResolvedValueOnce({
          status: Status.SUCCESS,
          message: 'Token Valid',
          data: {
            twiterId: '123'
          }
        })
        const response = await request(app).post('/mail/claim_mail').set('Authorization', `Bearer ${validToken}`).send({
          mailId: '1',
          userId: '123'
        })
        expect(response.status).toBe(500)
        expect(response.body).toEqual({
          status: Status.ERROR,
          message: "(claimMail) Error: Cannot destructure property 'status' of '(intermediate value)' as it is undefined."
        })
      })
    })
  })
})
