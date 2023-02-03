const fs = require('fs')
const env = require('node-env-file')
env(__dirname + '/../.env')
const etherscan = require('../utils/etherscan.js')
const jsondb = require('../utils/jsondb')

/*
  Purpose: Get transaction data from etherscan and save it to disk.

  Note this script takes a while, and it generates the transaction 
  files needed for all other programs to analyze and use.
  All of these are synchronized to the last block from etherscan 
  because that is where we pull the data.
*/ 

const main = async () => {
  
  const lastBlock = await etherscan.lastBlock()

  // Extract all the transactions that are visible from etherscan's interface
  // Note Not all transactions are visible, particularly contract to contract interactions
  const whackd = '0xCF8335727B776d190f9D15a54E6B9B9348439eEE'
  
  if (!await fs.existsSync(__dirname + '/../data/' + whackd + '_block.json')){
    await jsondb.writeBlockFile(whackd, 8943162)
  }
  await etherscan.syncLocation(whackd, lastBlock)

  // the rest of this study collect the other transactions and also stores them into relative files.

  // "unitrade deployer" is a short series of whackd airdrops that occurred but somehow the 
  // transactions didnt show up in the etherscan transactions for whackd - so we 
  // call for them
  const unitrade = '0x1fB5DB7213572Ac59cE876185d726EeC19EECe91'
  etherscan.setBlocksPerQuery(1000000)
  if (!await fs.existsSync(__dirname + '/../data/' + unitrade + '_block.json')) {
    await jsondb.writeBlockFile(unitrade, 10400000)
  }
  await etherscan.syncLocation(unitrade, lastBlock)

  // the dev did all the aridrops but in two different methods. They are detected via the 
  // input data but there were some group airdrops performed later as well
  // this aims to select addresses from these secondary airderps
  const dev = '0x23D3808fEaEb966F9C6c5EF326E1dD37686E5972'
  etherscan.setBlocksPerQuery(28400)
  if (!await fs.existsSync(__dirname + '/../data/' + dev + '_block.json')) {
    await jsondb.writeBlockFile(dev, 10422709)
  }
  // TODO set lastBlock to something after the airdrops here, its downloading all tx from 10422709
  await etherscan.syncLocation(dev, lastBlock)

  // the actual uniswap contract that is regularly in use. This has a lot of transactions
  const uniswap = '0xc491405d542A393D8d202a72F0FB076447e61891'
  etherscan.setBlocksPerQuery(100000)
  if (!await fs.existsSync(__dirname + '/../data/' + uniswap + '_block.json')) {
    await jsondb.writeBlockFile(uniswap, 10203800)
  }
  await etherscan.syncLocation(uniswap, lastBlock)

  // additionally several addresses do not show up after adding these in bulk. 
  // The following adds misc. addresses to a misc file.
  const miscFile = __dirname + '/../data/' + whackd + '_misc.json'

  const discover1 = '0x881d40237659c251811cec9c364ef91dc08d300c' // an eoa
  const discover2 = '0x74de5d4FCbf63E00296fd95d33236B9794016631' // some dex aggregagtor oss
  const discover3 = '0xc3c12a9e63e466a3ba99e07f3ef1f38b8b81ae1b' // switchdex
  const discover4 = '0x22F9dCF4647084d6C31b2765F6910cd85C178C18' // exchange proxy flash wallet
  const discover5 = '0xe66b31678d6c16e9ebf358268a790b763c133750'
  const discover6 = '0xe213012a73550BfCa9928d54f3609E4a3C1961b5' // apparently an old uni pool

  const filter1 = await etherscan.tokenContractFilter(discover1, whackd, 0, lastBlock)
  await addDb(filter1, miscFile)

  const filter2 = await etherscan.tokenContractFilter(discover2, whackd, 0, lastBlock)
  await addDb(filter2, miscFile)

  const filter3 = await etherscan.tokenContractFilter(discover3, whackd, 0, lastBlock)
  await addDb(filter3, miscFile)

  const filter4 = await etherscan.tokenContractFilter(discover4, whackd, 0, lastBlock)
  await addDb(filter4, miscFile)

  const filter5 = await etherscan.tokenContractFilter(discover5, whackd, 0, lastBlock)
  await addDb(filter5, miscFile)

  const filter6 = await etherscan.tokenContractFilter(discover6, whackd, 0, lastBlock)
  await addDb(filter6, miscFile)

  console.log('Process completed.')

}

/*
  Add transactions to a misc transaction file
*/
const addDb = async (transactions, miscFile) => {
  if (!fs.existsSync(miscFile)) {
    await fs.writeFileSync(miscFile, JSON.stringify([]))
  }
  const _misc = await fs.readFileSync(miscFile)
  const misc = JSON.parse(_misc)
  const newRecords = []
  for (let i = 0; i < transactions.length; i++) {
    let found = false
    for (let j = 0; j < misc.length; j++) {
      if (misc[j][2] === transactions[i].hash) {
        console.log('Did not add, transaction was found in misc file')
        found = true
      }
    }
    if (found === false) {
      const insert = etherscan.prepareDb(transactions[i], 'mainnet', 'erc')
      newRecords.push(insert)
    }
  }
  console.log('Adding: ' + newRecords.length + ' new transactions')
  const data = [...newRecords, ...misc]
  await fs.writeFileSync(miscFile, JSON.stringify(data, null, 4))
}


;(async () => {
  try {
    await main()
  } catch (error) {
    console.log(error)
  }
  process.exit(1)
})()