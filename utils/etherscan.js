const axios = require('axios')

const { getBlockFile, writeBlockFile, getTxFile, writeTxFile } = require('./jsondb.js')
const { timeFmtDb, dateNowBKK } = require('./dateutils.js')

const prepareDb = (tx, blockchain, type) => {
  const res = [
    null, // positionId
    blockchain, // blockchain
    tx.hash ? tx.hash : null,
    type,
    tx.blockNumber ? tx.blockNumber : null,
    tx.timeStamp ? tx.timeStamp : null,
    tx.nonce ? tx.nonce : null,
    tx.from ? tx.from.toLowerCase() : null,
    tx.to ? tx.to.toLowerCase() : null,
    tx.contractAddress > 0 ? tx.contractAddress.toLowerCase() : 0, // insert zero if no contract address
    tx.value > 0 ? tx.value : 0,
    tx.tokenName ? tx.tokenName : null,
    tx.tokenSymbol ? tx.tokenSymbol : null,
    tx.tokenDecimal ? tx.tokenDecimal : null,
    tx.gas ? tx.gas : null,
    tx.gasPrice ? tx.gasPrice : null,
    tx.gasUsed ? tx.gasUsed : null,
    tx.input ? tx.input : null,
    tx.confirmations ? tx.confirmations : null,
    tx.isError ? tx.isError : null
  ]
  return res
}

// Etherscan limits transactions reported to 10k so it blocksPerQuery must be lower than x transactions in block range. 

let blocksPerQuery = 10000

module.exports = {

  prepareDb,

  setBlocksPerQuery: (blocks) => {
    if (blocks >= 10) {
      blocksPerQuery = blocks
      return true
    }
    console.log('couldnt set blocks per query')
    return false
  },

  normalTransactions: async function (address, startBlock, endBlock) {
    try {
      const url = 'https://api.etherscan.io/api?module=account&action=txlist&address=' + address + '&startblock=' + startBlock + '&endblock=' + endBlock + '&sort=asc&apikey=' + process.env.ETHERSCAN_API_KEY;
      const result = await axios.get(url)
      return result.data.result
    } catch (error) {
      if (error.isAxiosError) {
        console.log(error.response.status, error.response.statusText)
      } else {
        console.log(error)
      }
    }
  },

  internalTransactions: async function (address, startBlock, endBlock) {
    try {
      const url = 'https://api.etherscan.io/api?module=account&action=txlistinternal&address=' + address + '&startblock=' + startBlock + '&endblock=' + endBlock + '&sort=asc&apikey=' + process.env.ETHERSCAN_API_KEY;
      const result = await axios.get(url)
      return result.data.result
    } catch (error) {
      if (error.isAxiosError) {
        console.log(error.response.status, error.response.statusText)
      } else {
        console.log(error)
      }
    }
  },

  erc20Transactions: async function (address, startBlock, endBlock) {
    try {
      const url = 'https://api.etherscan.io/api?module=account&action=tokentx&address=' + address + '&startblock=' + startBlock + '&endblock=' + endBlock + '&sort=asc&apikey=' + process.env.ETHERSCAN_API_KEY;
      //console.log(url)
      const result = await axios.get(url)
      return result.data.result
    } catch (error) {
      if (error.isAxiosError) {
        console.log(error.response.status, error.response.statusText)
      } else {
        console.log(error)
      }
    }
  },

  lastBlock: async () => {
    try {
      const now = Math.floor(dateNowBKK() / 1000)
      const url = 'https://api.etherscan.io/api?module=block&closest=before&action=getblocknobytime&timestamp=' + now + '&apikey=' + process.env.ETHERSCAN_API_KEY;
      const result = await axios.get(url)
      return result.data.result
    } catch (error) {
      if (error.isAxiosError) {
        console.log(error.response.status, error.response.statusText)
      } else {
        console.log(error)
      }
    }
  },

  getBlockAtTimestamp: async (epoch) => {
    console.log('Notice: Using Etherscan to get Block at timestamp')
    try {
      console.log(epoch)
      const time = Math.floor(epoch / 1000)
      const url = 'https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=' + time + '&closest=before' + '&apikey=' + process.env.ETHERSCAN_API_KEY;
      const result = await axios.get(url)
      return result.data.result
    } catch (error) {
      if (error.isAxiosError) {
        console.log(error.response.status, error.response.statusText)
      } else {
        console.log(error)
      }
    }
  },

  syncLocation: async (address, lastBlock) => {
    let highBlock = await getBlockFile(address)
    if (typeof highBlock === 'undefined') {
      await writeBlockFile(address, 0)
      highBlock = 0
    }
    thisBegin = 0
    console.log(timeFmtDb(dateNowBKK()) + ' ' + address + ' blockHeight: ' + highBlock)
    let begin = highBlock
    while (begin < lastBlock) {
      try {
        const txFile = await getTxFile(address)
        let end = begin + blocksPerQuery - 1;
        thisBegin = begin
        const erc = await module.exports.erc20Transactions(address, begin, end)
        const norm = await module.exports.normalTransactions(address, begin, end)
        const internal = await module.exports.internalTransactions(address, begin, end)
        console.log('Erc20 Found: ' + erc.length + ' Normal Found: ' + norm.length + ' Internal Found: ' + internal.length + ' ' + begin + ' -> ' + end)
        if (erc.length > 9999 || norm.length > 9999 || internal.length > 9999) {
          console.log('Too many transactions per block range. Reduce blocksPerQuery, delete everything in data and start again.')
          process.exit(1)
        }  
        const newTx = []
        begin = begin + blocksPerQuery
        for (let i = 0; i < erc.length; i++) {
          const data = prepareDb(erc[i], 'mainnet', 'erc')
          newTx.push(data)
        }
        for (let i = 0; i < norm.length; i++) {
          const data = prepareDb(norm[i], 'mainnet', 'normal')
          newTx.push(data)
        }
        for (let i = 0; i < internal.length; i++) {
          const data = prepareDb(internal[i], 'mainnet', 'internal')
          newTx.push(data)
        }
        // update high block before continuing
        let sync = end
        if (sync > lastBlock) {
          sync = lastBlock
        }
        await writeTxFile(address, [...txFile, ...newTx] )
        await writeBlockFile(address, sync)
        
        // WHACKD hack to expedite sync
        if (address.toLowerCase() === '0xcf8335727b776d190f9d15a54e6b9b9348439eee') {
          if (begin > 9050000) {
            module.exports.setBlocksPerQuery(100000)
          }
          if (begin > 12343159 && begin < 12843158) {
            module.exports.setBlocksPerQuery(10000)
          }
          if (begin > 12843158) {
            module.exports.setBlocksPerQuery(100000)
          }
        }

        // uniswap tweak to expedite sync
        if (address.toLowerCase() === '0xc491405d542A393D8d202a72F0FB076447e61891'.toLowerCase()) {
          if (begin > 12400000) {
            module.exports.setBlocksPerQuery(40000)
          }
          if (begin > 12663000) {
            module.exports.setBlocksPerQuery(2000)
          }
          if (begin > 13003799) {
            module.exports.setBlocksPerQuery(50000)
          }
        }

        if (sync === lastBlock) {
          console.log('process complete.')
          break
        }
      } catch (error) {
        console.log(error)
        console.log('Rolling back: ' + begin + ' -> ' + thisBegin)
        begin = thisBegin; // roll back
        console.log('taking a break')
        await  new Promise(r => setTimeout(r, 5000))
      }
    }
  },

  tokenContractFilter: async(contract, tokenContract, startBlock, endBlock) => {
    try {
      const url = 'https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=' + tokenContract + '&address=' + contract + '&startblock=' + startBlock + '&endblock=' + endBlock + '&sort=asc&apikey=' + process.env.ETHERSCAN_API_KEY;
      //console.log(url)
      const result = await axios.get(url)
      return result.data.result
    } catch (error) {
      if (error.isAxiosError) {
        console.log(error.response.status, error.response.statusText)
      } else {
        console.log(error)
      }
    }

  }
}
