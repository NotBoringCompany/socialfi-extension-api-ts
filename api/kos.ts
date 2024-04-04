// export const getEv = () => {
//     const items = [
//         { price: 1523.95, probability: 0.005 },
//         { price: 1080.00, probability: 0.009 },
//         { price: 855.00, probability: 0.02 },
//         { price: 765.00, probability: 0.02 },
//         { price: 712.35, probability: 0.03 },
//         { price: 450.00, probability: 0.03 },
//         { price: 207.00, probability: 0.15 },
//         { price: 201.03, probability: 0.15 },
//         { price: 186.37, probability: 0.15 },
//         { price: 170.11, probability: 0.25 },
//         { price: 159.52, probability: 0.1 },
//         { price: 145.40, probability: 0.15 },
//         { price: 108.17, probability: 0.3 },
//         { price: 105.43, probability: 0.4 },
//         { price: 87.30, probability: 0.3 },
//         { price: 66.97, probability: 0.25 },
//         { price: 62.10, probability: 0.25 },
//         { price: 59.45, probability: 0.25 },
//         { price: 58.74, probability: 0.25 },
//         { price: 54.72, probability: 0.75 },
//         { price: 44.99, probability: 0.6 },
//         { price: 37.10, probability: 0.5 },
//         { price: 31.38, probability: 0.5 },
//         { price: 28.61, probability: 0.5 },
//         { price: 28.52, probability: 0.75 },
//         { price: 22.22, probability: 0.75 },
//         { price: 21.46, probability: 0.75 },
//         { price: 20.70, probability: 1 },
//         { price: 18.76, probability: 1.5 },
//         { price: 17.13, probability: 0.6 },
//         { price: 14.83, probability: 3 },
//         { price: 13.51, probability: 1.5 },
//         { price: 13.07, probability: 2 },
//         { price: 8.55, probability: 3.25 },
//         { price: 8.19, probability: 3.5 },
//         { price: 7.67, probability: 6.5 },
//         { price: 7.19, probability: 9 },
//         { price: 6.75, probability: 10 },
//         { price: 0.10, probability: 25 },
//         { price: 0.10, probability: 25 }
//       ];

//       // get probability sum
//         const probabilitySum = items.reduce((acc, item) => acc + item.probability, 0);
//         console.log('probabilitySum: ', probabilitySum);

//         // get ev by multiplying price to probability/100
//         const ev = items.reduce((acc, item) => acc + (item.price * (item.probability / 100)), 0);

//         console.log('ev: ', ev);
// }

// getEv();