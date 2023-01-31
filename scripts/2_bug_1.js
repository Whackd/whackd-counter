const hre = require("hardhat")
const ethers = hre.ethers

const decimals = require('../utils/decimals.js')
const { d, displayToWei, weiToDisplay } = decimals

/* 
  In this test bug 1 is illustrated in action. 
  Bug 1 does not increment the random number when transferFrom is called.
*/

const run = async () => {

  const network = process.env.HARDHAT_NETWORK;
  if (typeof (network) === 'undefined') {
    console.log("Try: npx hardhat run --network <network> filepath");
    process.exit(1);
  }

  const [owner, receiver] = await ethers.getSigners()

  console.log("\nThe current deployer address is: " + owner.address)
  console.log("The current network to deploy on is: " + network)

  const balance = await ethers.provider.getBalance(owner.address)
  if (Number(balance) < 100) {
    console.log('ETH Balance for ' + owner.address + ' is insufficient: ' + Number(balance))
    process.exit(1)
  }
  console.log('Deployer ETH balance: ' + d(balance, 18))

  const Contract = await hre.ethers.getContractFactory("Epstein")
  const contract = await Contract.deploy()
  await contract.deployed()
  contractAddress = contract.address
  console.log("WHACKD deployed to: " + contractAddress + ' on ' + network)

  // Now that the contract is deployed lets see some things
  const metrics = async () => {
    const a = contract.balanceOf(owner.address)
    const b = contract.balanceOf(receiver.address)
    const [balance, balancer] = await Promise.all([a, b])
    const counter = await contract.random()
    console.log('Owner Bal: ' + weiToDisplay(balance, 18) + ' Receiver Bal: ' + weiToDisplay(balancer, 18) + ' count: ' + counter)
    // const storage = Number(await ethers.provider.getStorageAt(contractAddress, 6))
    // console.log(storage) // this works
  }
  await metrics()

  // now lets generate some trannies
  const transfer = async () => {
    await contract.connect(owner).transfer(receiver.address, ethers.BigNumber.from(displayToWei('1000', 18)))
  }

  const transferFrom = async () => {
    await contract.connect(owner).transferFrom(owner.address, receiver.address, ethers.BigNumber.from(displayToWei('1000', 18)))
  }

  for (let i = 0; i < 10; i++) {
    await transfer()
    await metrics()
  }
  await metrics()
  // here the owner account approves himself to call the transfer to function, simulating a contract call
  await contract.connect(owner).approve(owner.address, ethers.constants.MaxUint256)

  console.log('This time we can see the counter did not increment when calling transferFrom')
  for (let i = 0; i < 10; i++) {
    await transferFrom()
    await metrics()
  }

  console.log('Only when calling transfer does the counter increment')
  await transfer()
  await metrics()
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