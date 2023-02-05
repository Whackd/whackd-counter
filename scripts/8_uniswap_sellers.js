const fs = require('fs')
const env = require('node-env-file')

env(__dirname + '/../.env')
const abi = require('../utils/abi.json')
const { map, tokenContractFilter } = require('../utils/etherscan.js')

/* 
  Purpose: Observe sellers using uniswap and determine which ones have consolidated multiple airdrops

  Note that this keeps running until the beginning of the uniswap pool, which after about ten minutes 
  there is only a bunch of active wallets being detected

  */

const uniswap = '0xc491405d542A393D8d202a72F0FB076447e61891'
const burn = '0x0000000000000000000000000000000000000000'
const whackd = '0xCF8335727B776d190f9D15a54E6B9B9348439eEE'

const run =  async () => {
  const txns = await parseTxns()
  const swaps = filterNonSwaps(txns).reverse()
  // direction of the swap = buy or sell
  const buyoors = []
  const selloors = []
  for (let i = 0; i < swaps.length; i++) {
    const swap = swaps[i]
    if (swap.amountWhackd.from === uniswap.toLowerCase()) {
      buyoors.push(swap.amountWhackd.to)
    } else if (swap.amountWhackd.to === uniswap.toLowerCase()) {
      selloors.push({ address: swap.amountWhackd.from, block: swap.amountWhackd.blockNumber })
    }
  }
  console.log('Evaluating ' + selloors.length + ' sell swap transactions')

  const whitelist = {
    '0x18a32b6482baf61f83f47056990a72db78560dfc': 1,
    '0x76782b0a6C545D3Ea3eD82893B44735bD96011f8': 1,
    '0x58c419ca3b2f574b3507445d01abf37004b3fb9f': 1,
    '0xb84c445c3dcf6a7d99f02a140937c1498ab11c48': 1,
    '0x22ce29b9ea9e8b35e675d7801d13f710803155b3': 1
  }

  const abusoor = []
  const addAbusoor = (selloor) => {
    let found = false
    for (let i = 0; i < abusoor.length; i++) {
      if (abusoor[i].address === selloor.address) {
        found = true
      }
    }
    if (!found && !whitelist[selloor.address]) {
      console.log('https://etherscan.io/address/' + selloor.address + '#tokentxns')
      abusoor.push(selloor)
    }
  }

  for (let i = 0; i < selloors.length; i++) {
    const recents = await tokenContractFilter(selloors[i].address, whackd, selloors[i].block - 5000, selloors[i].block + 1) // what did we do in the last 5k blocks
    // In this context a "abusoor" has made more than 15 whackd transactions within 5000 blocks
    if (recents.length > 15) {
      addAbusoor(selloors[i])
    }
    if (i % 200 === 0) {
      console.log('Processed: ' + i + ' of ' + selloors.length + ' Found: ' + abusoor.length + ' redundant after 16 or so')
    }
  }

}

const filterNonSwaps = (txns) => {
  const swaps = []
  for (txn in txns) {
    let ignore = false
    const tx = txns[txn]
    // KNOWN ISSUE: I found some more complex swaps leave you with a function call and will be filtered here
    // See https://etherscan.io/tx/0x9cf01f404b2e4ceacac13eafb7aec0f48f8b85f36b2a97c3ce31a3bebea2fead
    if (tx.isContractCall || tx.isInternal || tx.univ2 || tx.function || !tx.amountWhackd) {
      ignore = true
    }
    if (ignore === false) swaps.push(tx)
  }
  return swaps
}

// Read and parse uniswap transactions into useable items:
const parseTxns = async () => {
  const _uniswapTx = await fs.readFileSync(__dirname + '/../data/' + uniswap + '_tx_0.json', 'utf8')
  let uniswapTx = JSON.parse(_uniswapTx)

  uniswapTx = uniswapTx.sort((a, b) => { return a[4] > b[4] ? 1 : -1 }) // sort by blockNumber
  const transactions = {}
  for (let i = 0; i < uniswapTx.length; i++) {
    const tx = map(uniswapTx[i])
    const hash = tx.hash
    if (!transactions[hash]) { 
      const proto = {
        burn: null,
        amountWhackd: null,
        amountWeth: null,
        univ2: null,
        isContractCall: null,
        isInternal: null,
        function: null
      }
      transactions[hash] = proto 
    }
    if (tx.to === burn) {
      transactions[hash].burn = tx
    }
    if (tx.tokenSymbol === 'WHACKD' && tx.to !== burn) {
      transactions[hash].amountWhackd = tx
    }
    if (tx.tokenSymbol === 'WETH') {
      transactions[hash].amountWeth = tx
    }
    if (tx.tokenSymbol === 'UNI-V2') {
      transactions[hash].univ2 = tx
      transactions[hash].isContractCall = true
    }
    if (tx.type === 'internal') {
      // console.log('internal, ignore: ' + tx.hash)
      transactions[hash].isContractCall = true
      transactions[hash].isInternal = true
    }
    if (tx.input && tx.input !== 'deprecated') {
      transactions[hash].function = tx
    }
    const shitcoins = {
      'KELPIE': 1,
      'HOGE': 1,
      'BEABULL': 1,
    }
    if (shitcoins[tx.tokenSymbol]) {
    }

  }
  return transactions
}

(async () => {
  try {
    await run()
  } catch (error) {
    console.log(error)
  }
  process.exit()
})();