import CryptoJS from 'crypto-js';
import { areSetsEqual, calcWinnerLeafNodes, calcWinnerMerkleRoot, calcWinnerMerkleTree } from '../utils/lottery';
import { ReturnValue, Status } from '../utils/retVal';
import mongoose from 'mongoose';
import { LotterySchema } from '../schemas/Lottery';
import { generateDrawSeed, generateObjectId, generateServerSeed, hashServerSeed } from '../utils/crypto';
import { Prize, Ticket, Winner } from '../models/lottery';
import { lotteryPrizeTier, lotteryTicketCost } from '../utils/constants/lottery';
import { UserSchema } from '../schemas/User';
import { getLotteryContractBalance } from '../utils/web3';
import { LOTTERY_CONTRACT, LOTTERY_CONTRACT_USER } from '../utils/constants/web3';
import { Resource, ResourceType } from '../models/resource';
import { ethers } from 'ethers';

/**
 * (User) purchases a new ticket for the current lottery draw using a `resourceType`.
 * 
 * If the user doesn't provide the `pickedNumbers`, the system will automatically generate random numbers for the user.
 */
export const purchaseTicket = async (
    twitterId: string, 
    resourceType: ResourceType,
    pickedNumbers: number[] | null | undefined
): Promise<ReturnValue> => {
    const Lottery = mongoose.model('Lottery', LotterySchema, 'Lottery');
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        // check if user exists
        const user = await User.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(purchaseTicket) User not found: ${twitterId}`
            }
        }

        // check price of the ticket
        const ticketCost = lotteryTicketCost(resourceType);

        // check if user has enough resources
        const userResources: Resource[] = user.inventory?.resources;

        // find the resource that matches the `resourceType`
        const resource = userResources?.find(r => r.type === resourceType);

        if (!resource) {
            return {
                status: Status.ERROR,
                message: `(purchaseTicket) User doesn't have enough resources: ${resourceType}`
            }
        }

        // check if the user has enough resources to purchase the ticket
        if (resource.amount < ticketCost) {
            return {
                status: Status.ERROR,
                message: `(purchaseTicket) User doesn't have enough resources: ${resourceType}`
            }
        }

        // get the latest lottery draw
        const lottery = await Lottery.findOne().sort({ drawId: -1 });

        if (!lottery) {
            return {
                status: Status.ERROR,
                message: '(purchaseTicket) No lottery found.'
            }
        }

        // check if the lottery is still open
        if (!lottery.open) {
            return {
                status: Status.ERROR,
                message: '(purchaseTicket) Current draw round is already closed. Please wait for the next one to open.'
            }
        }

        // check if `pickedNumbers` is empty; if yes, generate random numbers for the user (1st to 5th number = 1 - 69, 6th number = 1 - 26)
        if (!pickedNumbers) {
            // generate 5 unique numbers each between 1 - 69 (cannot be repeated)
            pickedNumbers = new Array(5).fill(0).map(() => {
                let number: number;

                do {
                    number = Math.floor(Math.random() * 69) + 1;
                } while (pickedNumbers.includes(number));

                return number;
            });

            // generate a special number between 1 - 26 and add it to the `pickedNumbers`
            pickedNumbers.push(Math.floor(Math.random() * 26) + 1);
        // if `pickedNumbers` is provided, check if it's valid
        } else {
            if (pickedNumbers.length !== 6) {
                return {
                    status: Status.ERROR,
                    message: '(purchaseTicket) Invalid amount of picked numbers.'
                }
            }

            const normalNumbers = pickedNumbers.slice(0, 5);
            const specialNumber = pickedNumbers[5];

            // check if the normal numbers are within 1 - 69 and the special number is within 1 - 26
            if (normalNumbers.some(n => n < 1 || n > 69) || specialNumber < 1 || specialNumber > 26) {
                return {
                    status: Status.ERROR,
                    message: '(purchaseTicket) Invalid picked numbers.'
                }
            }
        }

        // deduct the cost of the ticket from the user's resources
        const existingResourceIndex = (user.inventory.resources as Resource[]).findIndex(r => r.type === resourceType);

        // at this point, the resource should exist, given that we've checked this before, but we'll check again just in case
        if (existingResourceIndex === -1) {
            return {
                status: Status.ERROR,
                message: `(purchaseTicket) Resource not found: ${resourceType}`
            }
        }

        await User.updateOne(
            { twitterId }, 
            { $inc: { [`inventory.resources.${existingResourceIndex}.amount`]: -ticketCost } },
        );

        // add the ticket to the current lottery draw
        // check the current amount of tickets for the current draw (by checking the length of the `tickets` array) and increment it by 1
        const ticketId = lottery.tickets.length + 1;

        const ticket: Ticket = {
            ticketId,
            drawId: lottery.drawId,
            owner: user._id,
            pickedNumbers,
            purchaseTimestamp: Math.floor(Date.now() / 1000),
            resourcesSpent: {
                type: resourceType,
                amount: ticketCost
            }
        }

        // add the ticket to the lottery
        await Lottery.updateOne({ _id: lottery._id }, { $push: { tickets: ticket } });

        return {
            status: Status.SUCCESS,
            message: '(purchaseTicket) Ticket purchased successfully.',
            data: {
                drawId: lottery.drawId,
                ticketId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(purchaseTicket) ${err.message}`
        }
    }
}

/**
 * Claims the winnings for a user from a specific draw. If no `drawId` is provided, the system will claim the winnings from the latest draw (if applicable).
 */
export const claimWinnings = async (twitterId: string, drawId?: number): Promise<ReturnValue> => {
    const Lottery = mongoose.model('Lottery', LotterySchema, 'Lottery');
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        const lottery = drawId && drawId !== 0 ? await Lottery.findOne({ drawId }) : await Lottery.findOne().sort({ drawId: -1 });

        if (!lottery) {
            return {
                status: Status.ERROR,
                message: '(claimWinnings) No lottery found.'
            }
        }

        // check if user exists
        const user = await User.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimWinnings) User not found: ${twitterId}`
            }
        }

        // check in `lottery` if the `winners` contain the user's ID
        const winner: Winner = lottery.winners.find((w: Winner) => w.winner === user._id);

        if (!winner) {
            return {
                status: Status.ERROR,
                message: '(claimWinnings) User is not a winner for this draw.'
            }
        }

        // check if the user has already claimed the winnings for this draw
        if (winner.claimedPrize) {
            return {
                status: Status.ERROR,
                message: '(claimWinnings) User has already claimed the winnings for this draw.'
            }
        }

        // check if the user has a wallet address (they should; but this should return an error if they somehow don't)
        if (!user.wallet?.publicKey) {
            return {
                status: Status.ERROR,
                message: '(claimWinnings) User does not have a wallet address.'
            }
        }

        // call the `claimWinnings` function in the lottery contract using the user's pvt key and the `finalPrize` amount
        const lotteryContract = LOTTERY_CONTRACT_USER(user.wallet?.privateKey);

        // since prize is in ETH format, we need to convert it to wei
        const claimWinningsTx = await lotteryContract.claimWinnings(
            drawId || lottery.drawId,
            ethers.utils.parseEther(winner.finalPrize.toString())
        );
        await claimWinningsTx.wait();

        // if no errors, update the `claimedPrize` field in the `winners` array in the lottery
        await Lottery.updateOne({ _id: lottery._id, 'winners.winner': user._id }, { $set: { 'winners.$.claimedPrize': true } });

        return {
            status: Status.SUCCESS,
            message: '(claimWinnings) Winnings claimed successfully.',
            data: {
                drawId: lottery.drawId,
                prize: winner.finalPrize
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimWinnings) ${err.message}`
        }
    }
}

/**
 * Starts a new lottery draw, usually a bit after the previous draw is finalized.
 * 
 * Called by a scheduler.
 */
export const startNewDraw = async (): Promise<ReturnValue> => {
    const Lottery = mongoose.model('Lottery', LotterySchema, 'Lottery');

    try {
        // get the latest draw ID by obtaining the documents count
        // we assume that draws won't be removed from the database, thus we can safely use this method
        const latestDrawId = await Lottery.countDocuments();

        // generates a random server seed and get the hashed version of it
        const serverSeed = generateServerSeed();
        const hashedServerSeed = hashServerSeed(serverSeed);
        // generates a draw seed using blockchain data
        const { status, message, data } = await generateDrawSeed();

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(startNewDraw) Error from generateDrawSeed: ${message}`
            }
        }

        const drawSeed = data.drawSeed;

        // unix timestamp used for `createdTimestamp`
        const createdTimestamp = Math.floor(Date.now() / 1000);
        // calculate the finalization for the draw to be 7 days after the draw is created (now)
        const finalizationTimestamp = createdTimestamp + 604800;

        // create the new draw
        const newDraw = new Lottery({
            _id: generateObjectId(),
            open: true,
            drawId: latestDrawId + 1,
            createdTimestamp,
            finalizationTimestamp,
            tickets: [],
            winningNumbers: [],
            merkleRoot: '',
            serverSeed,
            hashedServerSeed,
            drawSeed,
            winners: []
        });

        await newDraw.save();

        return {
            status: Status.SUCCESS,
            message: '(startNewDraw) New draw started successfully.',
            data: {
                drawId: newDraw.drawId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(startNewDraw) ${err.message}`
        }
    }
}

/**
 * Finalizes the current lottery draw. 
 */
export const finalizeDraw = async (): Promise<ReturnValue> => {
    const Lottery = mongoose.model('Lottery', LotterySchema, 'Lottery');
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        // find the lottery with the latest ID (since we will currently only have 1 draw at a time each week; this is fine)
        const lottery = await Lottery.findOne().sort({ drawId: -1 });

        if (!lottery) {
            return {
                status: Status.ERROR,
                message: '(finalizeDraw) No lottery found.'
            }
        }

        // generate the winning numbers
        const serverSeed = lottery.serverSeed;
        const drawSeed = lottery.drawSeed;

        const winningNumbers = generateWinningNumbers(serverSeed, drawSeed);

        let winners: Winner[] = [];

        // loop through all tickets and calculate the prize for each, adding the winner to `winners`.
        const tickets = lottery.tickets as Ticket[];
        for (let ticket of tickets) {
            const pickedNumbers = ticket.pickedNumbers;
            const prize: Prize = lotteryPrizeTier(pickedNumbers, winningNumbers);

            // if no prize, continue to the next ticket
            if (prize.fixedAmount === 0 && prize.points === 0) continue;

            // if there is a prize (fixed amount or points), add the winner to the list
            // check first if the winner already exists in the list, if so, add the prize to the existing winner.
            let winner = winners.find(w => w.winner === ticket.owner);

            if (winner) {
                winner.ticketsWon.push(ticket.ticketId);
                // increment the `fixedAmount` and `points` of the winner based on this ticket's prize
                winner.totalPrizeWon.fixedAmount += prize.fixedAmount;
                winner.totalPrizeWon.points += prize.points;
                // if the winner doesn't exist, create a new winner
            } else {
                const user = await User.findOne({ _id: ticket.owner });

                // if user isn't found, don't return, just log the error and continue to the next ticket
                if (!user) {
                    console.error(`(finalizeDraw) User not found: ${ticket.owner}`);
                    continue;
                }

                // get the wallet address of the user
                const walletAddress = user.wallet?.publicKey;

                winners.push({
                    winner: ticket.owner,
                    winnerAddress: walletAddress,
                    ticketsWon: [ticket.ticketId],
                    totalPrizeWon: prize,
                    // final prize will be calculated after this based on `totalPrizeWon`
                    finalPrize: 0,
                    claimedPrize: false
                });
            }
        }

        // calculate the total amount of points obtained from each winner's `totalPrizeWon`
        const totalPoints = winners.reduce((acc, winner) => acc + winner.totalPrizeWon.points, 0);

        // calculate the current total prize pool in ETH (by checking the balance of the lottery contract)
        const lotteryBalance = await getLotteryContractBalance();

        // for each winner, finalize the `finalPrize` based on which value is lower from `fixedAmount` and `points` in `totalPrizeWon`
        for (let winner of winners) {
            const fixedAmountPrize = winner.totalPrizeWon.fixedAmount;
            const pointsPrize = winner.totalPrizeWon.points / totalPoints * lotteryBalance;

            winner.finalPrize = Math.min(fixedAmountPrize, pointsPrize);
        }

        // create a merkle tree and fetch its root from the winners with their respective prizes
        const leafNodes = calcWinnerLeafNodes(winners);
        const merkleTree = calcWinnerMerkleTree(leafNodes);
        const merkleRoot = calcWinnerMerkleRoot(merkleTree);

        // create a packed uint instance consisting of the winning numbers and the draw timestamp (which is now)
        let packedData = 0;
        const drawTimestamp = Math.floor(Date.now() / 1000);

        const SECOND_NUMBER_BITPOS = 8;
        const THIRD_NUMBER_BITPOS = 16;
        const FOURTH_NUMBER_BITPOS = 24;
        const FIFTH_NUMBER_BITPOS = 32;
        const SPECIAL_NUMBER_BITPOS = 40;
        const TIMESTAMP_BITPOS = 48;

        packedData |= winningNumbers[0];
        packedData |= winningNumbers[1] << SECOND_NUMBER_BITPOS;
        packedData |= winningNumbers[2] << THIRD_NUMBER_BITPOS;
        packedData |= winningNumbers[3] << FOURTH_NUMBER_BITPOS;
        packedData |= winningNumbers[4] << FIFTH_NUMBER_BITPOS;
        packedData |= winningNumbers[5] << SPECIAL_NUMBER_BITPOS;
        packedData |= drawTimestamp << TIMESTAMP_BITPOS;

        // update the lottery instance with the finalization timestamp, winning numbers, merkle root and winners
        // also disable the lottery from being open to ticket purchases anymore
        await Lottery.updateOne({ _id: lottery._id }, { $set: { 
            open: false,
            finalizationTimestamp: drawTimestamp, 
            winningNumbers: winningNumbers, 
            merkleRoot: merkleRoot,
            winners: winners
        }});

        // call `finalizeDraw` in the lottery contract with the packed data and the merkle root
        const finalizeDrawTx = await LOTTERY_CONTRACT.finalizeDraw(
            serverSeed,
            drawSeed,
            merkleRoot,
            packedData
        );

        await finalizeDrawTx.wait();

        return {
            status: Status.SUCCESS,
            message: '(finalizeDraw) Draw finalized successfully.',
            data: {
                winningNumbers,
                merkleRoot
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(finalizeDraw) ${err.message}`
        }
    }
}

/**
 * Generates the winning numbers for a lottery draw given the `serverSeed` and `drawSeed`.
 */
export const generateWinningNumbers = (serverSeed: string, drawSeed: string): Set<number> => {
    const combinedSeed = CryptoJS.SHA256(serverSeed + drawSeed).toString();

    let numbers: Set<number> = new Set();

    // generate 5 unique numbers each between 1 - 69 (cannot be repeated)
    while (numbers.size < 5) {
        const hash = CryptoJS.SHA256(combinedSeed + numbers.size).toString();
        const number = parseInt(hash, 16) % 69 + 1;

        numbers.add(number);
    }

    // since the special number can intersect with the other 5 numbers, we don't have to check for uniqueness
    const specialHash = CryptoJS.SHA256(combinedSeed + 5).toString();
    const specialNumber = parseInt(specialHash, 16) % 26 + 1;

    numbers.add(specialNumber);

    return numbers;
}

/**
 * Verifies if the winning numbers match the generated winning numbers from the server and draw seeds.
 * 
 * If this function returns true, then the draw is considered valid.
 */
export const verifyWinningNumbers = (serverSeed: string, drawSeed: string, winningNumbers: Set<number>): boolean => {
    const generatedNumbers = generateWinningNumbers(serverSeed, drawSeed);

    return areSetsEqual(generatedNumbers, winningNumbers);
}