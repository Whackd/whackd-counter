const fs = require('fs')

const datadir = __dirname + '/../data'

module.exports = {

  getData: async (token) => {
    try {
      const lastFilePath = datadir + '/' + token + '_last.json'
      let lastFile = await fs.readFileSync(lastFilePath, 'utf8')
      const highFileId = Number(lastFile.split('_')[2].split('.')[0])
      let alltx = []
      for (let i = 0; i <= highFileId; i++) {
        const data = await fs.readFileSync(datadir + '/' + token + '_tx_' + i + '.json', 'utf8')
        const parsed = JSON.parse(data)
        alltx = [...alltx, ...parsed]
        console.log(datadir + '/' + token + '_tx_' + i + '.json ' + parsed.length + ' ' + alltx.length)
      }
      return alltx
    } catch (error) {
      console.log(error)
    }
  },

  getMiscData: async (token) => {
    try {
      const data = await fs.readFileSync(datadir + '/' + token + '_misc.json', 'utf8')
      const parsed = JSON.parse(data)
      console.log(datadir + '/' + token + '_misc.json ' + parsed.length )
      return parsed
    } catch (error) {
      console.log(error)
    }
  },

  // whackd was created at 8943162, so setting the blockfile to 8943160 would remove redundant zero calls to etherslow
  getBlockFile: async (token) => {
    try {
      const filepath = datadir + '/' + token + '_block.json'
      const exists = await fs.existsSync(filepath)
      if (exists) {
        const data = await fs.readFileSync(filepath, 'utf8')
        return JSON.parse(data).block
      } else {
        await module.exports.writeBlockFile(token, 0)
      }
      return 0
    } catch (error) {
      console.log(error)
    }
  },

  writeBlockFile: async (token, block) => {
    try {
      const filepath = datadir + '/' + token + '_block.json'
      await fs.writeFileSync(filepath, JSON.stringify({ block: block }))
    } catch (error) {
      console.log(error)
    }
  },

  // returns a transaction file for appending. 
  // if the filesize exceeds 4 mb it returns a new empty file for appending
  getTxFile: async (token) => {
    try {
      const lastFilePath = datadir + '/' + token + '_last.json'
      const lastFileExists = await fs.existsSync(lastFilePath)
      if (!lastFileExists) {
        await fs.writeFileSync(lastFilePath, datadir + '/' + token + '_tx_0.json')
        await fs.writeFileSync(datadir + '/' + token + '_tx_0.json', JSON.stringify([]))
      }
      let lastFile = await fs.readFileSync(lastFilePath, 'utf8')
      const stats = await fs.statSync(lastFile)
      if (stats.size > 400000000) {
        const fileParts = lastFile.toString().split('_')
        const lastId = Number(fileParts[2].split('.')[0])
        const increment = lastId + 1
        const newPath = datadir + '/' + token + '_tx_' + increment + '.json'
        await fs.writeFileSync(lastFilePath, newPath)
        await fs.writeFileSync(newPath, JSON.stringify([]))        
        lastFile = newPath
      }
      const exists = await fs.existsSync(lastFile)
      if (exists) {
        const data = await fs.readFileSync(lastFile, 'utf8')
        return JSON.parse(data)
      }
      return []
    } catch (error) {
      console.log(error)
    }
  },

  // writes to the latest saved transaction file.
  writeTxFile: async (token, transactions) => {
    try {
      const lastFilePath = datadir + '/' + token + '_last.json'
      let lastFile = await fs.readFileSync(lastFilePath, 'utf8')
      console.log('writing to: ' + lastFile)
      await fs.writeFileSync(lastFile, JSON.stringify(transactions, null, 4), {flag:'w'})
    } catch (error) {
      console.log(error)
    }
  }

}