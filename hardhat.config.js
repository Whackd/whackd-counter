const env = require('node-env-file')
env(__dirname + '/.env')

require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-etherscan")

const lastBlock = 20108900 // june 17 2024 10:45 am

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }
    ]
  },
  networks: {
    hardhat: {
      accounts: { mnemonic: process.env.MNEMONIC },
      forking: {
        url: process.env.MAINNET_NODE,
        blockNumber: lastBlock
      }
    },
    // mainnet: {
    //   url: process.env.MAINNET_NODE,
    //   accounts: { mnemonic: process.env.MNEMONIC }
    // },
    // goerli: {
    //   url: process.env.GOERLI_NODE,
    //   accounts: { mnemonic: process.env.MNEMONIC }
    // },
    // sepolia: {
    //   url: process.env.SEPOLIA_NODE,
    //   accounts: { mnemonic: process.env.MNEMONIC }
    // },
  },
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY
  // }
};
