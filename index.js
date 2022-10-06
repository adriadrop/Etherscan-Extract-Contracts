#!/usr/bin/env node
const _ = require("lodash");
const ethers = require("ethers");
const parseArgs = require("minimist");
const fetch = require("node-fetch");
const fs = require("fs-extra");
const path = require("path");
const process = require("process");
require('dotenv').config()

const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;
const CONTRACT = process.env.CONTRACT;
const GOERLI =  (process.env.GOERLI === 'true');

const SUCCESS_MSG = "Contracts downloaded successfully!";
const ETHERSCAN_API = "https://api.etherscan.io/api";
const ETHERSCAN_GOERLI_API = "https://api-goerli.etherscan.io/api";
const ETHERSCAN_FAIL_STATUS = 0;
const BASE_CONTRACT_PATH = "contracts";
const SOL_MOD_INCL = "@";
const SOL_EXT = ".sol";
var ContractDIR = "sources/";

let makeContractQuery = (contractAddr, isGoerli) => {
  let esAPI = isGoerli || GOERLI ? ETHERSCAN_GOERLI_API : ETHERSCAN_API;
  console.log(esAPI);
  let contract = contractAddr != null ? contractAddr : CONTRACT;
  let contractCodeQuery = `?module=contract&action=getsourcecode&address=${contract}&apikey=${ETHERSCAN_KEY}`;
  let reqLink = `${esAPI}${contractCodeQuery}`;

  return fetch(reqLink);
};

let unwrapSourceCode = (sc) => {
  // don't know why etherscan puts double brackets on some results
  let res = _.attempt(JSON.parse, [sc]);
  let err = null;
  if (_.isError(res)) {
    let unwrapped = _.trim(sc).slice(1, -1);
    res = _.attempt(JSON.parse, [unwrapped]);
  }

  // last error check and return
  if (_.isError(res)) {
    err = res;
    res = null;
  }
  return err, res;
};

let handleSingletonSource = (contractName, contractContent) => {
  let res = {};
  let contractFile = `${contractName}.sol`;
  res[contractFile] = {
    content: contractContent,
  };

  return res;
};

let processESRes = (resObj) => {
  // map script name to file content
  let scriptsToContent = {};

  // check if req was successful
  if (resObj.status == ETHERSCAN_FAIL_STATUS) throw Error(resObj.result);

  let [innerRes] = resObj.result || {};
  let resSC = innerRes.SourceCode;
  ContractDIR = ContractDIR + innerRes.ContractName;
  let err,
    sc = unwrapSourceCode(resSC);
  if (!err) {
    if (sc && sc.sources) {
      scriptsToContent = sc.sources;
    } else {
      // handle singleton contract here
      let contractName = innerRes.ContractName;
      if (contractName)
        scriptsToContent = handleSingletonSource(contractName, resSC);
    }
  }

  return scriptsToContent;
};

let checkIfSolFile = (contractPath) => {
  return _.endsWith(contractPath, SOL_EXT);
};

let checkIfContractIsModule = (contractPath) => {
  // checks if contract is a downloaded module
  return (
    checkIfSolFile(contractPath) && _.startsWith(contractPath, SOL_MOD_INCL)
  );
};

let writeContracts = (scriptsToContent) => {
  // always check for valid contract filepath to avoid crazy stuff
  _.forIn(scriptsToContent, (contObj, contPath) => {
    if (!checkIfSolFile(contPath)) return;

    let contContent = contObj.content;
    let fullContPath = contPath; // building it out below

    // If module, add to contracts folder so included in scope
    if (checkIfContractIsModule(contPath))
      fullContPath = path.join(ContractDIR, BASE_CONTRACT_PATH, fullContPath);

    fullContPath = path.join(process.cwd(), ContractDIR, fullContPath);
    // write contrants to files
    fs.ensureFileSync(fullContPath, contContent);
    fs.writeFileSync(fullContPath, contContent);
  });
};

let exportMain = async (contractAddr, isGoerli = false) => {
  return makeContractQuery(contractAddr, isGoerli)
    .then((res) => res.json())
    .then(processESRes)
    .then(writeContracts)
    .then(() => console.log(SUCCESS_MSG));
};

let main = async () => {
  const parseArgsOpts = {
    alias: {
      g: "goerli",
    },
    boolean: ["goerli"],
    string: ["_"],
    unknown: ethers.utils.isAddress,
  };
  let parsedArgs = parseArgs(process.argv, parseArgsOpts);
  let contractAddr = parsedArgs._[0];
  let isGoerli = parsedArgs.goerli;

  if (contractAddr) {
    contractAddr = ethers.utils.getAddress(contractAddr);
    return exportMain(contractAddr, isGoerli);
  } else {
    return exportMain(null, isGoerli);
    //throw Error("No valid contract address provided!");
  }
};

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = exportMain;
