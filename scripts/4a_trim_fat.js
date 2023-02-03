const fs = require('fs')
const env = require('node-env-file')
env(__dirname + '/../.env')

/*
  Purpose: Etherscan sync retrieved all transactions from dev wallet but
  only a percent are actual whackd transactions. Remove non WHACKD transactions from file,
  to expedite further processing
*/ 

const devFile = __dirname + '/../data/0x23D3808fEaEb966F9C6c5EF326E1dD37686E5972_tx_0.json'

;(async () => {
  try {
    const _data = await fs.readFileSync(devFile)
    const data = JSON.parse(_data)
    const newData = []
    for (let i = 0; i < data.length; i++) {
      let pass = false
      if (data[i][12] === 'WHACKD' || data[i][9] === '0xcf8335727b776d190f9d15a54e6b9b9348439eee') {
        pass = true
      }
      if (pass) {
        newData.push(data[i])
      }
    }
    console.log('original: ' + data.length + ' new: ' + newData.length)
    await fs.writeFileSync(devFile, JSON.stringify(newData, null, 4))
    console.log('Process complete.')
  } catch (error) {
    console.log(error)
  }  
  process.exit(0)
})()