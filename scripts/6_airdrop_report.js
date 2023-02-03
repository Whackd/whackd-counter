const ethers = require('ethers')
const env = require('node-env-file')
const InputDataDecoder = require('ethereum-input-data-decoder')

env(__dirname + '/../.env')
const abi = require('../utils/abi.json')
const decoder = new InputDataDecoder(abi)
const jsondb = require('../utils/jsondb.js')
const decimals = require('../utils/decimals.js')
const { bigD, weiToDisplay, displayToWei, d } = decimals

const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_NODE, 1)

/* 
  Purpose: Work in progress, Analyze airdrop recipients

  airdrop analytics. Try to locate airdrop addresses and determine what types of hodlers exist
  This makes some basic assumptions about the value of the airdrops but later I discovered there 
  was a separate bulk airdrop method which sent out airdrops with various balances, probably to
  friends and such. 

*/

const run = async () => {

  // These are addresses to which most of the whackd ecosystem has touched
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

  // grab a list of recipients from the input data in the transaction files for airdrops of a value:
  const recipients = []
  for (let i = 0; i < txns.length; i++) {
    const tx = map(txns[i])
    const data = decoder.decodeData(tx.input)
    if (typeof data.inputs !== 'undefined' && data.inputs.length > 1) {
      // Airdrop sender
      if (data.inputs[1].toString() === '11972156190000000000000') {
        tx['decode'] = data
        recipients.push(tx)
      }
    }
    if (i % 10000 === 0) {
      console.log('Processed: ' + i + ' txns...')
    }
  }

  // work in progress, determine some stats about airdrop holders
  // currently not filtering by unique addresses

  let claimed = 0
  const unclaimed = []
  const uninited = []
  const dustyWallet = []
  const realWallet = []
  let unclaimedunInitBal = ethers.BigNumber.from('0')
  for (let i = 0; i < recipients.length; i++) {
    const receiver = recipients[i].decode.inputs[0]
    const balance = await whackdContract.balanceOf(receiver)
    if (balance > 0) {
      // for unclaimed airdrops we check the balance of eth as well
      if (balance.toString() === '10774940571000000000000' || balance.toString() === '21549881142000000000000') { // this is the balance after the burn
        unclaimed.push(recipients[i])
        const eth = await provider.getBalance(receiver)
        if (eth.toString() === '0') {
          // a recipient with zero eth balance
          // console.log('unclaimedZero: ' + receiver + ': ' + d(balance.toString(), 18) + ' ' + d(eth, 18))
          uninited.push(recipients[i])
          unclaimedunInitBal = unclaimedunInitBal.add(balance)
        } else {
          // a recipient who has a positive eth balance
          // we can break these down further as to whether or not there is dust in the eth account or actual value
          if (eth.gt(ethers.BigNumber.from(1000000000000000))) {
            // dusty in here
            dustyWallet.push(recipients[i])
            console.log('unclaimedDusty: ' + receiver + ': ' + d(balance.toString(), 18) + ' ' + d(eth, 18))
          } else {
            // real wallet
            realWallet.push(recipients[i])
            console.log('unclaimedReal: ' + receiver + ': ' + d(balance.toString(), 18) + ' ' + d(eth, 18))
          }
        }
      } else {
        // a claimed airdrop will have a different balance, and this is a real person or spent bal
        if (Number(balance.toString()) > Number(displayToWei('1', 18))) {
          console.log('outstanding ' + receiver + ': ' + d(balance.toString(), 18))
        } else {
          claimed += 1
          // console.log('claimed ' + receiver + ': ' + d(balance.toString(), 18))
        }
      }
    }
  }

  console.log('Dusty wallets who havent claimed airdrop: ' + dustyWallet.length)
  console.log('In Use Wallets who havent claimed airdrop: ' + realWallet.length)
  console.log('Uninited, unclaimed tokens: ' + unclaimedunInitBal.toString())
  console.log('Claimed airdrops: ' + claimed)
  console.log('Unclaimed airdrops: ' + unclaimed.length)
  console.log('Of these, there are ' + + uninited.length + ' address with zero eth which are unclaimed:')

  process.exit()
}

const map = (tx) => {
  const res = {
    positionId: null,
    blockchain: tx[1],
    hash: tx[2],
    type: tx[3],
    blockNumber: tx[4],
    timeStamp: tx[5],
    nonce: tx[6],
    from: tx[7],
    to: tx[8],
    contractAddress: tx[9],
    value: tx[10],
    tokenName: tx[11],
    tokenSymbol: tx[12],
    tokenDecimal: tx[13],
    gas: tx[14],
    gasPrice: tx[15],
    gasUsed: tx[16],
    input: tx[17],
    confirmations: tx[18],
    isError: tx[19]
  }
  return res
}

  ; (async () => {
    try {
      await run()
    } catch (error) {
      console.log(error)
    }
    process.exit(0)
  })()
