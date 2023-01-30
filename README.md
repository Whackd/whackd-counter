# WHACKD token contract issues

The WHACKD contract has two "bugs" in it causing the burn transaction to be 
more random than just 1 out of every 1000 transactions. The counter only increments 
when the "transfer" function is called and not when the "transferFrom" function is called.

There is a separate bug that this causes where if the counter is 999 ALL subsequent
calls to "transferFrom" are 100% burned until a normal "transfer" call resets the counter.

In order to determine the exact number of the "random" variable, you would need to 
observe the contract calls to "transfer", and ignore all other transactions. Then, you 
would need to observe what type of contract call the 1000th call was 
(in this case 1000 is 999) and if it was a "transferFrom" call, you would have to reset 
your counter to zero only on the next "transfer" call was made on chain.

technically, to implement something to detect the state of the count, you could sync 
the transaction history with etherscan and then decode the method using a package 
like https://github.com/miguelmota/ethereum-input-data-decoder and then determine where 
the count is by iterating the transactions.

@snowkidind


## Test 1 - normal operation

  In this test normal operation is proven accurate because the only contract calls 
  were to transfer which was implemented correctly.

  there were some modifications to the contract:
  - made the "random" variable public so you can observe it
  - minted an initial supply of 12M to owner on init


`npx hardhat run --network hardhat scripts/1_normal_operation.js`

```
The current deployer address is: 0xE63273D26197B2bE39023531BBa82B2b7Fa73205
The current network to deploy on is: hardhat
Deployer ETH balance: 10000
WHACKD deployed to: 0x182f2f1F43781804fCAb7A75Cdcdeb752FF352bf on hardhat
Owner Bal: 1200000 Receiver Bal: 0 count: 0
transferred: 0 times...
transferred: 100 times...
transferred: 200 times...
transferred: 300 times...
transferred: 400 times...
transferred: 500 times...
transferred: 600 times...
transferred: 700 times...
transferred: 800 times...
transferred: 900 times...
Owner Bal: 201000 Receiver Bal: 899100 count: 999
The final transferrrrrr:
Owner Bal: 200000 Receiver Bal: 899100 count: 0
```


## Test 2: Bug 1 

  In this test bug 1 is illustrated in action. 
  Bug 1 does not increment the random number when transferFrom is called.


`npx hardhat run --network hardhat scripts/2_bug_1.js`

```
The current deployer address is: 0xE63273D26197B2bE39023531BBa82B2b7Fa73205
The current network to deploy on is: hardhat
Deployer ETH balance: 10000
WHACKD deployed to: 0x182f2f1F43781804fCAb7A75Cdcdeb752FF352bf on hardhat
Owner Bal: 1200000 Receiver Bal: 0 count: 0
Owner Bal: 1199000 Receiver Bal: 900 count: 1
Owner Bal: 1198000 Receiver Bal: 1800 count: 2
Owner Bal: 1197000 Receiver Bal: 2700 count: 3
Owner Bal: 1196000 Receiver Bal: 3600 count: 4
Owner Bal: 1195000 Receiver Bal: 4500 count: 5
Owner Bal: 1194000 Receiver Bal: 5400 count: 6
Owner Bal: 1193000 Receiver Bal: 6300 count: 7
Owner Bal: 1192000 Receiver Bal: 7200 count: 8
Owner Bal: 1191000 Receiver Bal: 8100 count: 9
Owner Bal: 1190000 Receiver Bal: 9000 count: 10
Owner Bal: 1190000 Receiver Bal: 9000 count: 10
This time we can see the counter did not increment when calling transferFrom
Owner Bal: 1189000 Receiver Bal: 9900 count: 10
Owner Bal: 1188000 Receiver Bal: 10800 count: 10
Owner Bal: 1187000 Receiver Bal: 11700 count: 10
Owner Bal: 1186000 Receiver Bal: 12600 count: 10
Owner Bal: 1185000 Receiver Bal: 13500 count: 10
Owner Bal: 1184000 Receiver Bal: 14400 count: 10
Owner Bal: 1183000 Receiver Bal: 15300 count: 10
Owner Bal: 1182000 Receiver Bal: 16200 count: 10
Owner Bal: 1181000 Receiver Bal: 17100 count: 10
Owner Bal: 1180000 Receiver Bal: 18000 count: 10
Only when calling transfer does the counter increment
Owner Bal: 1179000 Receiver Bal: 18900 count: 11
```


## Test 3: Bug 2

  In this test bug 2 is illustrated in action. 
  Bug 2 does not reset the random number when transferFrom is called.


`npx hardhat run --network hardhat scripts/3_bug_2.js`

```
The current deployer address is: 0xE63273D26197B2bE39023531BBa82B2b7Fa73205
The current network to deploy on is: hardhat
Deployer ETH balance: 10000
WHACKD deployed to: 0x182f2f1F43781804fCAb7A75Cdcdeb752FF352bf on hardhat
Owner Bal: 1200000 Receiver Bal: 0 count: 0
transferred: 0 times...
transferred: 100 times...
transferred: 200 times...
transferred: 300 times...
transferred: 400 times...
transferred: 500 times...
transferred: 600 times...
transferred: 700 times...
transferred: 800 times...
transferred: 900 times...
Owner Bal: 201000 Receiver Bal: 899100 count: 999
here, observe the counter does not reset (nor increment) and the transaction is whackd
Owner Bal: 200000 Receiver Bal: 899100 count: 999
here, notice subsequent calls this way also get whackd
Owner Bal: 199000 Receiver Bal: 899100 count: 999
Only when a normal transfer function is called does the counter reset to zero
Owner Bal: 198000 Receiver Bal: 899100 count: 0
since the counter was reset, subsequent calls to transferFrom operate as expected
Owner Bal: 197000 Receiver Bal: 900000 count: 0
```