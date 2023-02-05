const env = require('node-env-file')
env(__dirname + '/../.env')
const fs = require('fs')
const ethers = require('ethers')
const InputDataDecoder = require('ethereum-input-data-decoder')
const whackdAbi = require('../utils/abi.json')
const abi = require('../utils/univ2Router2.json')
const balancesAbi = require('../utils/univ2Pair.json')
const wethAbi = require('../utils/weth.json')
const decoder = new InputDataDecoder(abi)
const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_NODE, 1)
const { timeFmtDb } = require('../utils/dateutils.js')
const { d, bigD, round } = require('../utils/decimals.js')
const { eventLogsByAddressTopics, eventLogsByAddress3Topics } = require('../utils/etherscan.js')

/* 
  Purpose: 

    NOTICE: Work In Progress

    Observe liquidity providers on uniswapV2 
    Discover additional swap transactions pushed via uniswapV2 contract

  Context: 
    Add liquidity contract calls are sent to an entirely different contract 
    address altogether and are thusly not added to the transactions we have pulled
    Also there were more contract calls discovered which isolates a specific bot
    which arbitrages WHACKD to another deflationary token called BSOV

  Balances:
    Eth Balance on contract: 7.294436131461110626
    Whackd Balance on contract: 6917076.928068121631822001
    UNI-V2 Balance on contract: 1988.504801351662679299

  Active LPs
    0x8d1c34bf3b58f2d5ca18766e360fb161f3b72708 481.49 UNI-V2 24.21%, 1.76 ETH
    0x803b1c8af205cbbe5e38a7ef9873d73017c2fb62 375.95 UNI-V2 18.90%, 1.37 ETH
    0x0128687783e76d08b2a7769a18b849e1781ac7b0 260.91 UNI-V2 13.12%, 0.95 ETH
    0xeef869c9e492fcfcc984ded4fb63d2178d4a0761 243.89 UNI-V2 12.26%, 0.89 ETH
    0xe07e487d5a5e1098bbb4d259dac5ef83ae273f4e 180.51 UNI-V2 9.07%, 0.66 ETH
    0x33b81fd90e38cd67e6b23e09193b8ab1e8a8761d 67.26 UNI-V2 3.38%, 0.24 ETH
    0x3d29a7d969b41cd902dbbdb4169ac1f3367a1a45 62.03 UNI-V2 3.11%, 0.22 ETH
    0x17966f7e987a42d00a633fa0219fded049682406 50.75 UNI-V2 2.55%, 0.18 ETH
    0x2958db51a0b4c458d0aa183e8cfb4f2e95cf6e75 31.90 UNI-V2 1.60%, 0.11 ETH
    0x64426f4de43d9adf5ab4ce7b7022d4c2a24c11a0 23.98 UNI-V2 1.20%, 0.08 ETH
    0x2bb58dabe2241e7b047be92c1cf0da00d72863d8 22.24 UNI-V2 1.11%, 0.08 ETH
    0xf527875b0663dfef61b238ee26e8b9c49a6962d0 21.83 UNI-V2 1.09%, 0.08 ETH
    0xfc3557d3ee3e3c9634ee1a285caca71171f38847 18.47 UNI-V2 0.92%, 0.06 ETH
    0x85d136022dcf554d2850ea82d7e4162d2430b811 17.40 UNI-V2 0.87%, 0.06 ETH
    0x625375a46ba245c5ecbd47bdb37e8bfc7a092974 14.92 UNI-V2 0.75%, 0.05 ETH
    0x0b35811511049012fe83d9cdfd8cab7d2c80aaab 14.88 UNI-V2 0.74%, 0.05 ETH
    0xa42ce0e92051f931e9e896036c471931443b5580 12.99 UNI-V2 0.65%, 0.04 ETH
    0x67387ed4cf7f6281e836fa201ff68abc7c05fa4a 10.89 UNI-V2 0.54%, 0.03 ETH

*/

const uniswapV2Router2 = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d'
const v2RouterToken = '0xc491405d542A393D8d202a72F0FB076447e61891' // this is where the pool balances are kept
const weth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const whackd = '0xCF8335727B776d190f9D15a54E6B9B9348439eEE'
const useCache = true

const run = async () => {

  const allAddresses = []
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

  const wethContract = new ethers.Contract(weth, wethAbi, provider)
  const whackdContract = new ethers.Contract(whackd, whackdAbi, provider)
  const uniV2Contract = new ethers.Contract(v2RouterToken, balancesAbi, provider)

  let trannies = []
  const cacheFile = __dirname + '/../data/' + uniswapV2Router2 + '_lp_report.json'
  if (fs.existsSync(cacheFile) && useCache) {
    const t = await fs.readFileSync(cacheFile, 'utf8')
    trannies = JSON.parse(t)
    trannies.forEach((tr) => {
      addAddress(tr.source)
    })
  } else {
    console.log('Notice: Getting fresh data...')
    const topic0Rem = '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496'
    const topic1Rem = '0x0000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d'
    const topic2Rem = '0x0000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d'
    const remLogs = await eventLogsByAddress3Topics(topic0Rem, topic1Rem, topic2Rem, v2RouterToken)
    for (let i = 0; i < remLogs.length; i++) {
      const logTx = remLogs[i]
      const tx = await provider.getTransaction(logTx.transactionHash)
      const a = whackdContract.balanceOf(v2RouterToken, { blockTag: Number(tx.blockNumber) })
      const b = wethContract.balanceOf(v2RouterToken, { blockTag: Number(tx.blockNumber) })
      const c = provider.getTransactionReceipt(tx.hash)
      const _d = provider.getBlock(tx.blockNumber)
      const [balanceAlt, balanceWeth, receipt, _blockTimestamp] = await Promise.all([a,b,c,_d])
      const blockTimestamp = _blockTimestamp.timestamp
      const date = timeFmtDb(blockTimestamp * 1000)
      addAddress(tx.from)
      let valueEth
      let valueAlt
      receipt.logs.forEach((l) => {
        if (l.address === whackd) {
          const recipient = ethers.utils.defaultAbiCoder.decode(['address'], l.topics[2]).toString()
          if (recipient === tx.from) {
            valueAlt = d(ethers.utils.defaultAbiCoder.decode(['uint'], l.data).toString(), 18)
          }
        }
        if (l.address.toLowerCase() === weth) {
          valueEth = d(ethers.utils.defaultAbiCoder.decode(['uint'], l.data).toString(), 18)
        }
      })
      trannies.push({
        blockHeight: tx.blockNumber,
        type: 'remove',
        hash: tx.hash,
        source: tx.from,
        message: date + ' ' + tx.from + ' Remove:'.padEnd(9) + round(valueAlt, 3).padEnd(12) + ' WHACKD and ' + round(valueEth, 4) + ' ETH',
        valueAlt: valueAlt,
        valueEth: valueEth,
        balanceAlt: d(balanceAlt.toString(), 18),
        balanceEth: d(balanceWeth.toString(), 18)
      })
    }
  
    const topic0 = '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f'
    const topic1 = '0x0000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d'
    const logs = await eventLogsByAddressTopics(topic0, topic1, v2RouterToken)
    for (let i = 0; i < logs.length; i++) {
      const logTx = logs[i]
      const tx = await provider.getTransaction(logTx.transactionHash)
      const a = whackdContract.balanceOf(v2RouterToken, { blockTag: Number(tx.blockNumber) })
      const b = wethContract.balanceOf(v2RouterToken, { blockTag: Number(tx.blockNumber) })
      const c = await provider.getTransactionReceipt(tx.hash)
      const _d = await provider.getBlock(tx.blockNumber)
      const [balanceAlt, balanceWeth, receipt, _blockTimestamp] = await Promise.all([a, b, c, _d])
      const blockTimestamp = _blockTimestamp.timestamp
      const date = timeFmtDb(blockTimestamp * 1000)
      addAddress(tx.from)
      let valueEth
      let valueAlt
      receipt.logs.forEach((l) => {
        if (l.address === whackd) {
          const recipient = ethers.utils.defaultAbiCoder.decode(['address'], l.topics[1]).toString()
          if (recipient === tx.from) {
            valueAlt = d(ethers.utils.defaultAbiCoder.decode(['uint'], l.data).toString(), 18)
          }
        }
        if (l.address.toLowerCase() === weth) {
          valueEth = d(ethers.utils.defaultAbiCoder.decode(['uint'], l.data).toString(), 18)
        }
      })
      if (!valueAlt || !valueEth) {
        console.log('Nope.')
        process.exit()
      }
      trannies.push({
        blockHeight: tx.blockNumber,
        type: 'add',
        hash: tx.hash,
        source: tx.from,
        message: date + ' ' + tx.from + ' Add:'.padEnd(9) + round(valueAlt, 3).padEnd(12) + ' WHACKD and ' + round(valueEth, 4) + ' ETH',
        valueAlt: valueAlt,
        valueEth: valueEth,
        balanceAlt: d(balanceAlt.toString(), 18),
        balanceEth: d(balanceWeth.toString(), 18)
      })
    }
    await fs.writeFileSync(cacheFile, JSON.stringify(trannies, null, 4))
  }
  trannies = trannies.sort((a, b) => { return a.blockHeight > b.blockHeight ? 1 : -1})
  trannies.forEach((t) => {
    console.log(t.hash + ' ' + t.message + ' totalWhackd:' + round(t.balanceAlt, 3).padEnd(16) + ' totalEth:' + round(t.balanceEth, 4))
  })

  let rollers = []
  let uniV2Supply = (await uniV2Contract.totalSupply()).toString()
  for (let i = 0; i < allAddresses.length; i++) {
    const bal = (await uniV2Contract.balanceOf(allAddresses[i])).toString()
    if (Number(bal) > 0) {
      rollers.push({ address: allAddresses[i], balance: bal})
    }
  }
  rollers = rollers.sort((a, b) => { return Number(a.balance) > Number(b.balance) ? -1 : 1 })
  const _ethBal = await wethContract.balanceOf(v2RouterToken)
  const ethBal = d(_ethBal.toString(), 18)
  const uV2Supply = d(uniV2Supply, 18)
  
  const _whackdBal = await whackdContract.balanceOf(v2RouterToken)
  const whackdBal = d(_whackdBal.toString(), 18)

  console.log()
  console.log('Eth Balance on contract: ' + ethBal)
  console.log('Whackd Balance on contract: ' + whackdBal)
  console.log('UNI-V2 Balance on contract: ' + uV2Supply)
  console.log()
  console.log('Active LPs')
  rollers.forEach((r) => {
    const bal = d(r.balance, 18, 2)
    const perc = bigD(bal).divide(bigD(uV2Supply)).multiply(bigD('100'))
    const withdrawableEth = round(bigD(ethBal).multiply(perc).divide(bigD('100')).getValue(), 2)
    console.log(r.address + ' ' + bal + ' UNI-V2 ' + round(perc.getValue(), 2) + '%, ' + withdrawableEth  + ' ETH ' )
  })
}

(async () => {
  try {
    await run()
  } catch (error) {
    console.log(error)
  }
  process.exit()
})();