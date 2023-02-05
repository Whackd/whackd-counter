const fs = require('fs')
const env = require('node-env-file')
const InputDataDecoder = require('ethereum-input-data-decoder')

env(__dirname + '/../.env')
const abi = require('../utils/univ2.json')
const decoder = new InputDataDecoder(abi)
const { map, tokenContractFilter } = require('../utils/etherscan.js')

/* 
  Purpose: Observe liquidity providers on uniswap

  */

const uniswap = '0xc491405d542A393D8d202a72F0FB076447e61891'
const burn = '0x0000000000000000000000000000000000000000'
const whackd = '0xCF8335727B776d190f9D15a54E6B9B9348439eEE'

const run = async () => {
  const txns = await parseTxns()
  const lptx = filterNonLp(txns)
  

  for (let i = 0; i < lptx.length; i++) {
    const tx = lptx[i]
    if (i === 0) {
      continue;
    }
    if (tx.univ2.from === uniswap.toLowerCase()) {
      console.log('Add: ' + tx.univ2.hash) // im guessing these dont exist because the origin is 0x
    } if (tx.univ2.to === uniswap.toLowerCase()) {
      console.log('Remove: ' + tx.univ2.hash)
    } else {
      console.log(tx)
    }
    
  }
}

const filterNonLp = (txns) => {
  const lps = []
  for (t in txns) {
    let filter = false
    const tx = txns[t]
    if (tx.function) {
      const data = decoder.decodeData(tx.function.input)
      if (data.method === 'approve') {
        filter = true
      } else if (data.method === 'skim') {
        filter = true
      } else if (data.method === 'sync') { // call to sync()
        filter = true
      } else if (data.method === 'swap') { // a complex swap
        filter = true
      } else if (tx.function.isError === '1') { // an error occurred during execution
        filter = true
      } else {
        console.log(tx) // log out anything else that may show up
        console.log(data)
      }
    }

    // unknown LP transaction with mystery input data (see etherscan)
    if (tx.amountWeth && (tx.amountWeth.hash === '0x62a88573bb9b5d21ec89e1c186eed89c6ed70e2b6fee59927d1c639b1f01dc1a' || 
      tx.amountWeth.hash === '0x3a66ff7d88857e34d346d72f1fafa8e528edb03b470093a5a2089e339b89325b')) {
      filter = true
    }

    // special case, the initial LP tx: 0x0602009285252491e41d195d9c9240d680c7dd6069db4a72ef7e750126bf7002
    if (tx.amountWhackd && tx.amountWhackd.hash === '0x0602009285252491e41d195d9c9240d680c7dd6069db4a72ef7e750126bf7002') {
      //debug
      filter = true
    }
    
    if (!tx.burn && !tx.amountWhackd && !tx.amountWeth && !tx.univ2 && !tx.function ) { // nothing burger
      filter = true
    }

    if (!tx.univ2) { // for this method this is really all that is needed
      filter = true
    }
    
    if (filter === false) {
      lps.push(tx)
    }
  }
  return lps
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
        internal: null,
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
      transactions[hash].isContractCall = true
      transactions[hash].isInternal = true
      transactions[hash].internal = tx
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