const env = require('node-env-file')
env(__dirname + '/../.env')
const jsondb = require('../utils/jsondb.js')
const decimals = require('../utils/decimals.js')
const etherscan = require('../utils/etherscan.js')
const { bigD, weiToDisplay, displayToWei, round, d, noExponents } = decimals
const abi = require('../utils/abi.json')
const InputDataDecoder = require('ethereum-input-data-decoder');
const decoder = new InputDataDecoder(abi)
const ethers = require('ethers')
const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_NODE, 1)
const fs = require('fs')
const axios = require('axios')

/* 
  Compare ethplorer api results with our own, in order to find inconsistencies

  this pulls the top 1000 holders from the ethplorer api and then comapres them 
  with the top holders that have been calculated. When the ethplorer reports a holder
  who is unidentified it is printed and gies you a good lead to find the bug / next contract
  to add to the misc file.

*/
const wallets = async (address) => {

  // Top token holders
  const url = 'https://api.ethplorer.io/getTopTokenHolders/' + address + '?apiKey=' + process.env.ETHPLORER_API_KEY + '&limit=1000'
  const res = await axios.get(url)
  const _top1000 = res.data.holders
  let top1000 = []
  for (let i = 0; i < _top1000.length; i++) {
    top1000.push({
      address: _top1000[i].address,
      balance: noExponents(_top1000[i].balance),
      share: _top1000[i].share
    })
  }

  // Now, retrieve our recorded balances and compare
  const balancesFile = await fs.readFileSync(__dirname + '/../data/' + address + '_balances.json')
  const balances = await JSON.parse(balancesFile)
  const sorted = balances.sort((a, b) => { return Number(a.balance) > Number(b.balance) ? -1 : 1 })
  for (let i = 0; i < top1000.length; i++) {
    if (top1000[i].address.toLowerCase() !== sorted[i].address.toLowerCase()) {
      let found = false
      for (let j = 0; j < balances.length; j++) {
        if (balances[j].address.toLowerCase() === top1000[i].address.toLowerCase()) {
          found = true
          break
        }
      }
      if (!found) {
        // this means there is data out there that you do not have
        console.log('Undetected: ' + top1000[i].address.toLowerCase() + ' at index: ' + i)
      }
    }
  }
  let sum = ethers.BigNumber.from('0')
  for (let i = 0; i < balances.length; i++) { 
    sum = sum.add(ethers.BigNumber.from(displayToWei(balances[i].balance, 18)))
  }
  const diff = ethers.BigNumber.from('1000000000000000000000000000').sub(sum) // max supply 1B
  // this should be as close to the max supply as possible
  console.log('sum of all known balances: ' + d(sum.toString(), 18))
  console.log('unknown: ' + d(diff.toString(), 18)) // should be as close to zero as possible
}

;(async () => {
  const whackd = '0xCF8335727B776d190f9D15a54E6B9B9348439eEE'
  await wallets(whackd)

  process.exit()
})()