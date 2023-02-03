const env = require('node-env-file')
env(__dirname + '/../.env')

const ethers = require('ethers')


/* 
  Purpose: Create a new mnemonic and derived addresses for wallet using increased entrophy

  As you can see it is easy to generate derived ethereum addresses which is how it is suspected 
  a airdrop hog may have created a lot of addresses from the same seed
*/

const run = async () => {
  console.log('\nHere is a new seed phrase:\n')
  const wallet = new ethers.Wallet.createRandom([{ extraEntropy: ethers.utils.randomBytes(16) }])
  console.log(wallet._mnemonic().phrase)
  console.log('\n   ' + 'index'.padEnd(50) + 'private key' )
  for (let i = 0; i < 10; i++) {
    const thisWallet = ethers.Wallet.fromMnemonic(wallet._mnemonic().phrase, `m/44'/60'/0'/0/${i}`)
    console.log(i + ': ' + thisWallet.address.padEnd(50) + thisWallet._signingKey().privateKey)
  }
  console.log()
}

  ; (async () => {
    try {
      await run()
    } catch (error) {
      console.log(error)
      process.exit(1)
    }
    process.exit(0)
  })()