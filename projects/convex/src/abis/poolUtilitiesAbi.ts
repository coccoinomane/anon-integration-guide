export const poolUtilitiesAbi = [
    {
        inputs: [],
        stateMutability: 'nonpayable',
        type: 'constructor',
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: '_rate',
                type: 'uint256',
            },
            {
                internalType: 'uint256',
                name: '_priceOfReward',
                type: 'uint256',
            },
            {
                internalType: 'uint256',
                name: '_priceOfDeposit',
                type: 'uint256',
            },
        ],
        name: 'apr',
        outputs: [
            {
                internalType: 'uint256',
                name: '_apr',
                type: 'uint256',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'booster',
        outputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'crv',
        outputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'cvx',
        outputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'cvxMining',
        outputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: '_pid',
                type: 'uint256',
            },
        ],
        name: 'rewardRates',
        outputs: [
            {
                internalType: 'address[]',
                name: 'tokens',
                type: 'address[]',
            },
            {
                internalType: 'uint256[]',
                name: 'rates',
                type: 'uint256[]',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
];
