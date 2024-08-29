import { addQuest } from './api/quest';

const quests = [
    // {
    //     name: 'Novice Crafter',
    //     description: 'Craft 5 items.',
    //     type: 'Daily',
    //     tier: null,
    //     status: true,
    //     limit: 1,
    //     category: 'Berry Factory',
    //     poi: null,
    //     acceptable: true,
    //     unlockable: false,
    //     rewards: [
    //         {
    //             rewardType: 'xCookies',
    //             minReceived: 5,
    //             maxReceived: 5,
    //         },
    //     ],
    //     completedBy: [],
    //     requirements: [
    //         {
    //             type: 'Craft Item',
    //             description: 'Craft 5 items.',
    //             parameters: {
    //                 count: 5,
    //             },
    //         },
    //     ],
    // },
    // {
    //     name: 'Novice Hoarder',
    //     description: 'Purchase 5 items.',
    //     type: 'Daily',
    //     tier: null,
    //     status: true,
    //     limit: 1,
    //     category: 'Berry Factory',
    //     poi: null,
    //     acceptable: true,
    //     unlockable: false,
    //     rewards: [
    //         {
    //             rewardType: 'xCookies',
    //             minReceived: 5,
    //             maxReceived: 5,
    //         },
    //     ],
    //     completedBy: [],
    //     requirements: [
    //         {
    //             type: 'Purchase Item',
    //             description: 'Purchase 5 items.',
    //             parameters: {
    //                 count: 5,
    //             },
    //         },
    //     ],
    // },
    // {
    //     name: 'Tap Tap',
    //     description: 'Finishing 5 isle tapping milestones.',
    //     type: 'Daily',
    //     tier: null,
    //     status: true,
    //     limit: 1,
    //     category: 'Berry Factory',
    //     poi: null,
    //     acceptable: true,
    //     unlockable: false,
    //     rewards: [
    //         {
    //             rewardType: 'xCookies',
    //             minReceived: 5,
    //             maxReceived: 5,
    //         },
    //     ],
    //     completedBy: [],
    //     requirements: [
    //         {
    //             type: 'Tapping Milestone',
    //             description: 'Finishing 5 isle tapping milestones.',
    //             parameters: {
    //                 count: 5,
    //             },
    //         },
    //     ],
    // },
    // {
    //     name: 'Boost this!',
    //     description: 'Use 5 gathering boosters.',
    //     type: 'Daily',
    //     tier: null,
    //     status: true,
    //     limit: 1,
    //     category: 'Berry Factory',
    //     poi: null,
    //     acceptable: true,
    //     unlockable: false,
    //     rewards: [
    //         {
    //             rewardType: 'xCookies',
    //             minReceived: 5,
    //             maxReceived: 5,
    //         },
    //     ],
    //     completedBy: [],
    //     requirements: [
    //         {
    //             type: 'Use Gathering Booster',
    //             description: 'Use 5 gathering boosters.',
    //             parameters: {
    //                 count: 5,
    //             },
    //         },
    //     ],
    // },
    {
        name: 'Apprentice Trader',
        description: 'Sell 30 resources.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Palmshade Village', 'Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 6,
                maxReceived: 6,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Sell Resource Amount',
                description: 'Sell 30 resources.',
                parameters: {
                    count: 30,
                },
            },
        ],
    },
    {
        name: 'Apprentice Crafter',
        description: 'Craft 15 items.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Palmshade Village', 'Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 6,
                maxReceived: 6,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Craft Item',
                description: 'Craft 15 items.',
                parameters: {
                    count: 15,
                },
            },
        ],
    },
    {
        name: 'Apprentice Hoarder',
        description: 'Purchase 15 items.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Palmshade Village', 'Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 6,
                maxReceived: 6,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Purchase Item',
                description: 'Purchase 15 items.',
                parameters: {
                    count: 15,
                },
            },
        ],
    },
    {
        name: 'Tap, Tap & Tap',
        description: 'Finishing 10 isle tapping milestones.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Palmshade Village', 'Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 6,
                maxReceived: 6,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Tapping Milestone',
                description: 'Finishing 10 isle tapping milestones.',
                parameters: {
                    count: 10,
                },
            },
        ],
    },
    {
        name: 'Boost these!',
        description: 'Use 15 boosters.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Palmshade Village', 'Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 6,
                maxReceived: 6,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Use Gathering Booster',
                description: 'Use 15 boosters.',
                parameters: {
                    count: 15,
                },
            },
        ],
    },
    {
        name: 'Traveller',
        description: 'Spend 30 mins travelling among POIs.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Palmshade Village', 'Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 6,
                maxReceived: 6,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Travel Time',
                description: 'Spend 30 mins travelling among POIs.',
                parameters: {
                    count: 30,
                },
            },
        ],
    },
    {
        name: 'Skilled Trader',
        description: 'Sell 60 resources.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 8,
                maxReceived: 8,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Sell Resource Amount',
                description: 'Sell 60 resources.',
                parameters: {
                    count: 60,
                },
            },
        ],
    },
    {
        name: 'Skilled Crafter',
        description: 'Craft 5 Uncommon or above items.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 8,
                maxReceived: 8,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Craft Item',
                description: 'Craft 5 Uncommon or above items.',
                parameters: {
                    value: 'Uncommon|Rare|Epic|Legendary',
                    count: 5,
                },
            },
        ],
    },
    {
        name: 'Skilled Hoarder',
        description: 'Purchase 30 items.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 8,
                maxReceived: 8,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Purchase Item',
                description: 'Purchase 30 items.',
                parameters: {
                    count: 30,
                },
            },
        ],
    },
    {
        name: 'Tapping Enjoyer',
        description: 'Finishing 20 isle tapping milestones.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 8,
                maxReceived: 8,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Tapping Milestone',
                description: 'Finishing 20 isle tapping milestones.',
                parameters: {
                    count: 20,
                },
            },
        ],
    },
    {
        name: 'Boost them all!',
        description: 'Use 25 boosters.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 8,
                maxReceived: 8,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Use Gathering Booster',
                description: 'Use 25 boosters.',
                parameters: {
                    count: 25,
                },
            },
        ],
    },
    {
        name: 'Seasoned Traveller!',
        description: 'Spend 2 hours travelling among POIs.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Seabreeze Harbor', 'Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 8,
                maxReceived: 8,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Travel Time',
                description: 'Spend 2 hours travelling among POIs.',
                parameters: {
                    count: 120,
                },
            },
        ],
    },
    {
        name: 'Adept Trader',
        description: 'Sell 100 resources.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 10,
                maxReceived: 10,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Sell Resource Amount',
                description: 'Sell 100 resources.',
                parameters: {
                    count: 100,
                },
            },
        ],
    },
    {
        name: 'Adept Crafter',
        description: 'Craft 15 Uncommon or above items.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 10,
                maxReceived: 10,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Craft Item',
                description: 'Craft 15 Uncommon or above items.',
                parameters: {
                    value: 'Uncommon|Rare|Epic|Legendary',
                    count: 15,
                },
            },
        ],
    },
    {
        name: 'Adept Hoarder',
        description: 'Purchase 50 items.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 10,
                maxReceived: 10,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Sell Resource Amount',
                description: 'Purchase 50 items.',
                parameters: {
                    count: 50,
                },
            },
        ],
    },
    {
        name: 'Tapping Lover',
        description: 'Finishing 30 isle tapping milestones.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 10,
                maxReceived: 10,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Tapping Milestone',
                description: 'Finishing 30 isle tapping milestones.',
                parameters: {
                    count: 30,
                },
            },
        ],
    },
    {
        name: 'Boost to oblivion!',
        description: 'Use 50 boosters.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 10,
                maxReceived: 10,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Use Gathering Booster',
                description: 'Use 50 boosters.',
                parameters: {
                    count: 50,
                },
            },
        ],
    },
    {
        name: 'Wanderer',
        description: 'Spend 4 hours travelling among POIs.',
        type: 'Daily',
        tier: null,
        status: true,
        limit: 1,
        category: 'Berry Factory',
        poi: ['Starfall Sanctuary'],
        acceptable: true,
        unlockable: false,
        rewards: [
            {
                rewardType: 'xCookies',
                minReceived: 10,
                maxReceived: 10,
            },
        ],
        completedBy: [],
        requirements: [
            {
                type: 'Travel Time',
                description: 'Spend 4 hours travelling among POIs.',
                parameters: {
                    count: 240,
                },
            },
        ],
    },
];

const main = async () => {
    console.log('starting...');
    for (const quest of quests) {
        await addQuest(quest as any);
    }
    console.log('finished...');
};

main();
