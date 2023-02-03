const fs = require('fs')
const perf = require('execution-time')()
const ethers = require('ethers')
const env = require('node-env-file')
const InputDataDecoder = require('ethereum-input-data-decoder')

env(__dirname + '/../.env')
const { v4 } = require("uuid")
const abi = require('../utils/abi.json')
const jsondb = require('../utils/jsondb.js')
const decimals = require('../utils/decimals.js')
const { map } = require('../utils/etherscan.js')
const { displayToWei, d } = decimals
const decoder = new InputDataDecoder(abi)

const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_NODE, 1)

/*

  Purpose: Generate ETH and WHACKD balances for all known WHACKD holders

  build a database of known wallet addresses and then 
  cache the all addresses file.
  poll node for balances for all addresses
  write the balances file which will contain all balances, ETH and WHACKD 
  Print some interesting statistics along the way
*/

let timer

const run = async () => {

  // Load tx files in the data dir by address + misc file
  const whackd = '0xCF8335727B776d190f9D15a54E6B9B9348439eEE'
  const txnsW = await jsondb.getData(whackd)
  const unitrade = '0x1fB5DB7213572Ac59cE876185d726EeC19EECe91'
  const txnsU = await jsondb.getData(unitrade)
  const dev = '0x23D3808fEaEb966F9C6c5EF326E1dD37686E5972'
  const txnsD = await jsondb.getData(dev)
  const uni = '0xc491405d542A393D8d202a72F0FB076447e61891'
  const txnsUni = await jsondb.getData(uni)
  const txnsMisc = await jsondb.getMiscData(whackd)
  const txns = [...txnsW, ...txnsU, ...txnsD, ...txnsUni, ...txnsMisc]

  console.log('Calculating report for ' + txns.length + ' items...')

  const whackdContract = new ethers.Contract(whackd, abi, provider)
  let allAddresses = []
  if (process.env.DEBUG === 'true' && fs.existsSync(__dirname + '/../data/' + whackd + '_eoa.json')) {
    allAddresses = JSON.parse(await fs.readFileSync(__dirname + '/../data/' + whackd + '_eoa.json', 'utf8'))
  } else {

    // check for duplicate address before adding to file. Time gobbler here
    const addAddress = (_address) => {
      try {
        if (!_address) {
          // sometimes its null
          return
        }
        const address = _address.toLowerCase()
        if (!ethers.utils.isAddress(address)) {
          console.log('Warning: Not an address: ' + address)
          return
        }
        const duplicate = allAddresses.map(function (a) { return a }).indexOf(address)
        if (duplicate === -1) {
          allAddresses.push(address)
        }
      } catch (error) {
        console.log(error)
        return
      }
    }

    // Extract target addresses from input data in order to detect addresses which received airdrops
    // Extract to and from addresses to detect normal EOAs
    for (let i = 0; i < txns.length; i++) {
      const tx = map(txns[i])
      const data = decoder.decodeData(tx.input)
      if (typeof data.inputs !== 'undefined' && data.inputs.length > 1) {
        addAddress('0x' + data.inputs[0])
        if (data.inputs.length > 3) {
          console.log(tx.hash)
          console.log(data)
        }
      }
      addAddress(tx.from)
      addAddress(tx.to)
      if (i % 1000 === 0) {
        if (typeof timer !== 'undefined') {
          const allDuration = perf.stop(timer);
          console.log('Found: ' + allAddresses.length + ' from ' + i + ' of ' + txns.length + ' txns. timer: ' + allDuration.preciseWords)
        }
        timer = v4()
        perf.start(timer)
      }
    }

    // Cache the first section. To skip subsequent calculations mark DEBUG=true in .env
    await fs.writeFileSync(__dirname + '/../data/' + whackd + '_eoa.json', JSON.stringify(allAddresses, null, 4))
  }

  console.log('WHACKD has passed through ' + allAddresses.length + ' accounts and contracts!')

  // Part two is to poll the balances of all accounts and do some analytics based on the balance results.
  console.log('NOTICE: Querying all balances... Hope you have a local node...')
  const holders = []
  const lessThanOneClub = []
  const oneClub = []
  const tenKClub = []
  const hundredKClub = []
  const millionClub = []
  let totalBalance = ethers.BigNumber.from('0')

  for (let i = 0; i < allAddresses.length; i++) {
    const a = whackdContract.balanceOf(allAddresses[i])
    const b = provider.getBalance(allAddresses[i])
    const [balance, eth] = await Promise.all([a, b])
    totalBalance = totalBalance.add(balance)
    if (Number(balance.toString()) > 0) {
      // Add any holder with a balance > 0, the rest is fun metric time.
      holders.push({ address: allAddresses[i], balance: d(balance.toString(), 18), eth: d(eth.toString(), 18) })
      if (balance.gt(ethers.BigNumber.from(displayToWei('1', 18)))) {
        if (balance.lt(ethers.BigNumber.from(displayToWei('13000', 18)))) {
          oneClub.push(allAddresses[i])
        } else if (balance.lt(ethers.BigNumber.from(displayToWei('100000', 18)))) {
          tenKClub.push(allAddresses[i])
        } else if (balance.lt(ethers.BigNumber.from(displayToWei('1000000', 18)))) {
          hundredKClub.push(allAddresses[i])
        } else {
          console.log('Million Club: ' + allAddresses[i] + ' ' + d(balance.toString(), 18))
          millionClub.push(allAddresses[i])
        }
      } else {
        lessThanOneClub.push(allAddresses[i])
      }
    }
    if (i % 1000 === 0) {
      console.log('processed ' + i + ' accounts of ' + allAddresses.length)
    }
  }

  console.log('Balance of all found holders: ' + totalBalance.toString())
  console.log('all: ' + allAddresses.length)
  console.log('hodlers: ' + holders.length)
  console.log('less than one: ' + lessThanOneClub.length)
  console.log('More than one, less than 13k: ' + oneClub.length)
  console.log('More than 13k, Less than 100k: ' + tenKClub.length)
  console.log('More than 100k, Less than 1M: ' + hundredKClub.length)
  console.log('More than 1M: ' + millionClub.length)

  // Create the balances report 
  await fs.writeFileSync(__dirname + '/../data/' + whackd + '_balances.json', JSON.stringify(holders, null, 4))
  console.log('Operation is complete.')
}

  ; (async () => {
    try {
      await run()
    } catch (error) {
      console.log(error)
    }
    process.exit(0)
  })()
  