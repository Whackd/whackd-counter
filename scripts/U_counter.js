
const env = require('node-env-file')
env(__dirname + '/../.env')

const ethers = require('ethers')
const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_NODE, 1)

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




