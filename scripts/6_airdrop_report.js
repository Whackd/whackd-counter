const fs = require('fs')
const env = require('node-env-file')
env(__dirname + '/../.env')
const ethers = require('ethers')

const { map } = require('../utils/etherscan.js')
const { d, bigD, round } = require('../utils/decimals.js')
/*
  Purpose: Dig through the devs token distribution wallet to answer the following questions:
  How many people were in the first airdrop?
    - this code reports that there were 37098 recipients to the first airdrop. 34813 were from unique addresses.
    - there is evidence of users who added large amounts of derived addresses to the airdrop form. We can guess the
      amount of outstanding accounts because they are left in an uninitialized state, with zero ETH.
  How many people were in the second airdrop?
    The second airdrop was different than the first in that the value of each recipient was not the same. 
    There were 11 Bulk transactions distributing various amounts between 1200 and 17 Million WHACKD. Most 
    transactions were under 20k but 0x1e5a1dcb87a9da0446a9e9e4890d53ff7eaede59c18b39fc675f0789f7979976 stands out
    as being the airdrop where large amounts were sent, presumably to founders, friends and family etc.
  Who received whackd and spent it?
  Who received whackd to an uninitialized address?
  Identify the non airdrop transactions where WHACKD was sent from the dev account (there were 149 additional transactions)

  Here are the results;

  First Airdrop Recipients:  37098
  Unique first airdrop recipients: 34813
  Second Airdrop Recipients: 1940
  Unique second airdrop recipients: 1940
  First Airdrop Total tokens: 399694267.204686
  Second Airdrop Total tokens: 224766837.035949717162
  Burned Airdrops: 36
  Other Burned outgoing transactions: 40
  Additional transactions: 149
  
  Part two balances...
  AIRDROP 1
    claimed ad1: 14843
    uninited ad1: 16076 totalling: 178823909 unspent WHACKD, a loose cannon
    dusty ad1: 2941 totalling: 24854543 unspent WHACKD, likely to not get spent liberally
    active ad1: 953 totalling: 18214886 unspent WHACKD, from legit addresses
  
  AIRDROP 2
    claimed ad2: 254
    uninited ad2: 297 totalling: 12463867 unspent WHACKD, a loose cannon
    dusty ad2: 666 totalling: 20713225 unspent WHACKD, likely to not get spent liberally
    active ad2: 723 totalling: 89732023 unspent WHACKD, from legit addresses
  
  TOTALS (from both airdrops combined)
    Airdrops claimed: 15097
    All uninited: 16373 totalling: 191287776 unspent WHACKD, a loose cannon
    All dusty: 3607 totalling: 45567769 unspent WHACKD, likely to not get spent liberally
    All active: 1676 totalling: 107946910 unspent WHACKD, from legit addresses

*/


const secondAirdropTxs = [
  '0x925db8829efefa053452aa40299005ea4c2feacad3c214c1bcf40120373815f9',
  '0x1e5a1dcb87a9da0446a9e9e4890d53ff7eaede59c18b39fc675f0789f7979976',
  '0x27f99d913d92f26c324e0a115e1e3a838ea592ed4bbf742a73d79f086ea17327',
  '0x5c42ec6b02f1705c7ec611b52c6080497ab19a1754df9448667ec81126a0c1e0',
  '0x61074baf8bd6b98679a884ef439614a1bfa1e4e4dee8b4fc87070edc626d9524',
  '0x4e5d1f424ab6c437fdec3d6824c9fac659837a498ae56a36fdd126f459db05a0',
  '0xa30c18ff0166be0ce4a6813f51d5ecc67c1e27389a8185a307d4fddfb5ed2784',
  '0xe73c882dabce3c943d538a7e8a548e7349248197c92f36b7b5c48ae47c7ee10e',
  '0x6c1978d2286500ebd4daba9998b01d8821a42428f3cb85b979a9563679f5d720',
  '0x49da17d6ecddbb235b72ddfd4968d1c33ec510de47fc5f78db4983d1b3e9f0db',
  '0x4f4c0eff104a73615a84d7f2f1ca731b749940caed742e5fda1cfce4e4750ae4',
  '0x2f0dde92a7e281dc0b699f82e0d4b8d6313eaaace4f1dded9420d8cdfa738c5d'
]

const isSecondAdTx = (hash) => {
  const found = secondAirdropTxs.map(function (a) { return a }).indexOf(hash)
  if (found > 0) return true
  return false
}

const devFile = __dirname + '/../data/0x23D3808fEaEb966F9C6c5EF326E1dD37686E5972_tx_0.json'
const balancesFilePath = __dirname + '/../data/0xCF8335727B776d190f9D15a54E6B9B9348439eEE_balances.json'

  ; (async () => {

    if (!fs.existsSync(devFile)) {
      console.log('First the dev transaction file must be synced')
      process.exit(1)
    }

    if (!fs.existsSync(balancesFilePath)) {
      console.log('First the balances file must be synced')
      process.exit(1)
    }

    try {
      const _data = await fs.readFileSync(devFile)
      const data = JSON.parse(_data)
      const firstAirdropRecipients = []
      let firstAdSum = ethers.BigNumber.from('0')
      let secondAdSum = ethers.BigNumber.from('0')
      const airdropWasBurned = []
      const otherWasBurned = []
      let additionalDrops = 0
      const secondAdRecipients = []
      for (let i = 0; i < data.length; i++) {
        const tx = map(data[i])
        if (tx.value === '10774940571000000000000' || tx.value === '9697500000000000000000') {
          firstAirdropRecipients.push(tx.to)
          firstAdSum = firstAdSum.add(ethers.BigNumber.from(tx.value))
        } else if (tx.value === '1197215619000000000000' || tx.value === '1077500000000000000000') {
          // burn tx from above
        } else if (tx.value === '11972156190000000000000' && tx.to === '0x0000000000000000000000000000000000000000') {
          airdropWasBurned.push(tx.hash)
        } else if (String(tx.value) === '0') {
          otherWasBurned.push(tx.hash)
        } else if (isSecondAdTx(tx.hash)) {
          secondAdRecipients.push(tx.to)
          secondAdSum = secondAdSum.add(ethers.BigNumber.from(tx.value))
        } else {
          console.log(tx.blockNumber + ' ' + tx.hash + ' ' + tx.from + ' => ' + tx.to + ' ' + d(tx.value, 18) + ' ' + tx.tokenSymbol)
          additionalDrops += 1
        } 
      }

      const firstAirdropRecipientsSet = new Set(firstAirdropRecipients)
      const secondAdRecipientsSet = new Set(secondAdRecipients)

      console.log('\nFirst Airdrop Recipients: ', firstAirdropRecipients.length)
      console.log('Unique first airdrop recipients: ' + firstAirdropRecipientsSet.size)
      console.log('Second Airdrop Recipients: ' + secondAdRecipients.length)
      console.log('Unique second airdrop recipients: ' + secondAdRecipientsSet.size)
      console.log('First Airdrop Total tokens: ' + d(firstAdSum.toString(), 18))
      console.log('Second Airdrop Total tokens: ' + d(secondAdSum.toString(), 18))
      console.log('Burned Airdrops: ' + airdropWasBurned.length)
      console.log('Other Burned outgoing transactions: ' + otherWasBurned.length)
      console.log('Additional transactions: ' + additionalDrops)

      console.log('\nPart two balances...')
      const _balances = await fs.readFileSync(balancesFilePath, 'utf8')
      const balances = JSON.parse(_balances)

      const findBal = (address) => {
        for (let i = 0; i < balances.length; i++) {
          if (address === balances[i].address) {
            return balances[i]
          }
        }
      }

      let claimedAd1 = 0
      let uninitedAd1 = 0
      let uninitedAd1Total = bigD('0')
      let dustyWalletAd1 = 0
      let dustyWalletAd1Total = bigD('0')
      let hotActiveAd1 = 0
      let hotActiveAd1Total = bigD('0')
      let uninitedAirdrop1 = []
      firstAirdropRecipientsSet.forEach((r) => {
        const balance = findBal(r)
        if (typeof balance === 'undefined') {
          // airdrop claimed, no balance
          claimedAd1 += 1
        } else {
          // airdrop unclaimed 
          if (balance.eth === '0') {
            // uninited airdrops are suspected derived wallets from a single or a few players
            uninitedAd1 += 1
            uninitedAd1Total = uninitedAd1Total.add(bigD(balance.balance))
            uninitedAirdrop1.push(r)
          } else {
            if (Number(balance.eth) < 0.01) {
              // dusty wallet unlikely to claim
              dustyWalletAd1 += 1
              dustyWalletAd1Total = dustyWalletAd1Total.add(bigD(balance.balance))
            } else {
              // active wallet with a hot airdrop
              hotActiveAd1 += 1
              hotActiveAd1Total = hotActiveAd1Total.add(bigD(balance.balance))
            }
          }
        }
      })

      console.log('AIRDROP 1')
      console.log('claimed ad1: ' + claimedAd1)
      console.log('uninited ad1: ' + uninitedAd1 + ' totalling: ' + round(uninitedAd1Total.getValue(), 0) + ' unspent WHACKD, a loose cannon')
      console.log('dusty ad1: ' + dustyWalletAd1 + ' totalling: ' + round(dustyWalletAd1Total.getValue(), 0) + ' unspent WHACKD, likely to not get spent liberally')
      console.log('active ad1: ' + hotActiveAd1 + ' totalling: ' + round(hotActiveAd1Total.getValue(), 0) + ' unspent WHACKD, from legit addresses')

      let claimedAd2 = 0
      let uninitedAd2 = 0
      let uninitedAd2Total = bigD('0')
      let dustyWalletAd2 = 0
      let dustyWalletAd2Total = bigD('0')
      let hotActiveAd2 = 0
      let hotActiveAd2Total = bigD('0')
      let uninitedAirdrop2 = []
      secondAdRecipientsSet.forEach((r) => {
        const balance = findBal(r)
        if (typeof balance === 'undefined') {
          // airdrop claimed, no balance
          claimedAd2 += 1
        } else {
          // airdrop unclaimed 
          if (balance.eth === '0') {
            // uninited airdrops are suspected derived wallets from a single or a few players
            uninitedAd2 += 1
            uninitedAd2Total = uninitedAd2Total.add(bigD(balance.balance))
            uninitedAirdrop2.push(r)
          } else {
            if (Number(balance.eth) < 0.01) {
              // dusty wallet unlikely to claim
              dustyWalletAd2 += 1
              dustyWalletAd2Total = dustyWalletAd2Total.add(bigD(balance.balance))
            } else {
              // active wallet with a hot airdrop
              hotActiveAd2 += 1
              hotActiveAd2Total = hotActiveAd2Total.add(bigD(balance.balance))
            }
          }
        }
      })

      console.log('\nAIRDROP 2')
      console.log('claimed ad2: ' + claimedAd2)
      console.log('uninited ad2: ' + uninitedAd2 + ' totalling: ' + round(uninitedAd2Total.getValue(), 0) + ' unspent WHACKD, a loose cannon')
      console.log('dusty ad2: ' + dustyWalletAd2 + ' totalling: ' + round(dustyWalletAd2Total.getValue(), 0) + ' unspent WHACKD, likely to not get spent liberally')
      console.log('active ad2: ' + hotActiveAd2 + ' totalling: ' + round(hotActiveAd2Total.getValue(), 0) + ' unspent WHACKD, from legit addresses')


      console.log('\nTOTALS')
      const gtClaimedCount = claimedAd1 + claimedAd2
      const gtUninitedCount = uninitedAd1 + uninitedAd2
      const gtDustyCount = dustyWalletAd1 + dustyWalletAd2
      const gtHotActiveCount = hotActiveAd1 + hotActiveAd2

      const gtUninited = uninitedAd1Total.add(uninitedAd2Total)
      const gtDusty = dustyWalletAd1Total.add(dustyWalletAd2Total)
      const gtHotActive = hotActiveAd1Total.add(hotActiveAd2Total)
      console.log('Airdrops claimed: ' + gtClaimedCount)
      console.log('All uninited: ' + gtUninitedCount + ' totalling: ' + round(gtUninited.getValue(), 0) + ' unspent WHACKD, a loose cannon')
      console.log('All dusty: ' + gtDustyCount + ' totalling: ' + round(gtDusty.getValue(), 0) + ' unspent WHACKD, likely to not get spent liberally')
      console.log('All active: ' + gtHotActiveCount + ' totalling: ' + round(gtHotActive.getValue(), 0) + ' unspent WHACKD, from legit addresses')

      const transformer = (set) => {
        const array = []
        set.forEach((item) => {
          array.push(item)
        })
        return array
      }

      const info = {
        claimedCount: gtClaimedCount,
        uninitedCount: gtUninitedCount,
        dustyCount: gtDustyCount,
        hotActiveCount: gtHotActiveCount,
        firstRecipients: transformer(firstAirdropRecipientsSet),
        uninitedAirdrop1: uninitedAirdrop1,
        uninitedAirdrop2: uninitedAirdrop2,
        secondRecipients: transformer(secondAdRecipientsSet)
      }

      await fs.writeFileSync(__dirname + '/../data/0xCF8335727B776d190f9D15a54E6B9B9348439eEE_uninited.json', JSON.stringify(info, null, 4))
      
      console.log('\nProcess complete.')
    } catch (error) {
      console.log(error)
    }
    process.exit(0)
  })()