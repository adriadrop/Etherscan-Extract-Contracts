## EtherScan smart contract extractooooor

Made according to API here
https://docs.etherscan.io/api-endpoints/contracts#get-contract-source-code-for-verified-contract-source-codes

-----
####  You can use it from CLI 
node index.js 0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03 --g

#### Ow with CONFIG, add .env file and add variables that would match
ETHERSCAN_KEY
CONTRACT
GOERLI

This is fork of https://github.com/wat96/get-contract-code with changes
- fixed some problem like missing ES key
- added config into the script
- updated testnet to Goerli
- use of dotenv for config
- output to directory of SC name