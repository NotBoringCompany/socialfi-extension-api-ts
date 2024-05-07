import { SquadLeaderboardModel } from '../utils/constants/db';

/**
 * Creates a new squad leaderboard each week at Sunday 23:59 UTC. Called by a scheduler.
 */
export const addSquadLeaderboard = async (): Promise<void> => {
    try {
        // get the latest week number
        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

        // if no leaderboard exists, create a new one
        if (!latestSquadLeaderboard) {
            await SquadLeaderboardModel.create({
                week: 1,
                pointsData: []
            });
            
            console.log('Created a new squad leaderboard for week 1.');
            return;
        // otherwise, get the latest week number and create a new leaderboard
        } else {
            await SquadLeaderboardModel.create({
                week: latestSquadLeaderboard.week + 1,
                pointsData: []
            });

            console.log(`Created a new squad leaderboard for week ${latestSquadLeaderboard.week + 1}.`);
            return;
        }
    } catch (err: any) {
        console.error('Error in addSquadLeaderboard:', err.message);
    }
}