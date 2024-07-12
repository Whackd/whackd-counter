
const env = require('node-env-file')
env(__dirname + '/../.env')

const ethers = require('ethers')
const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_NODE, 1)


/* 
  Purpose: Create a new mnemonic and derived addresses for wallet using increased entrophy

  As you can see it is easy to generate derived ethereum addresses which is how it is suspected 
  a airdrop hog may have created a lot of addresses from the same seed
*/

const run = async () => {
  const contractAddress = "0xCF8335727B776d190f9D15a54E6B9B9348439eEE"
  const storage = Number(await provider.getStorageAt(contractAddress, 6))
  console.log(storage)
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




