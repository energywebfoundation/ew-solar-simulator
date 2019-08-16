import program from 'commander';
import parse from 'csv-parse/lib/sync';
import fs from 'fs';
import Web3 from 'web3';

import CONFIG from '../config/config.json';

const web3 = new Web3(CONFIG.config.WEB3_URL);
const one = web3.utils.toWei('1');

program
    .option('-i, --input <path>', 'input I-REC csv file')
    .option('-o, --owner <string>', 'funding account private key');

program.parse(process.argv);

if (!program.input) {
    console.error(`Missing -i argument`);
    process.exit(1);
}

if (!program.owner) {
    console.error(`Missing -o argument`);
    process.exit(1);
}

if (!fs.existsSync(program.input)) {
    console.error(`${program.input} file does not exist`);
    process.exit(1);
}

let hasCorrectPrivateKey = true;

try {
    web3.eth.accounts.privateKeyToAccount(program.owner);
} catch (e) {
    hasCorrectPrivateKey = false;
}

if (!hasCorrectPrivateKey) {
    console.error(`${program.owner} is incorrect private key`);
    process.exit(1);
}

const processAssets = async parsedContent => {
    const output = [];
    const fundingAccount = web3.eth.accounts.privateKeyToAccount(program.owner);
    let id = 0;
    for (const asset of parsedContent) {
        console.log('---');
        console.log(`Processing ${asset['Device ID']} asset`);

        const maxCapacity = parseFloat(asset['Electrical Capacity (MW)']) * 10 ** 6;

        const account = web3.eth.accounts.create();

        console.log(`Generated smart meter address ${account.address}`);

        const signedTx = await fundingAccount.signTransaction({
            to: account.address,
            value: one
        });

        const fundingTx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        console.log(`Funding tx from ${fundingAccount.address} to ${account.address} has been broadcasted ${fundingTx.transactionHash}`);

        output.push({
            id: (id++).toString(),
            maxCapacity,
            smartMeterPrivateKey: account.privateKey,
            role: 'producer',
            manufacturer: '',
            model: '',
            serial_number: '',
            latitude: parseFloat(asset.Latitude),
            longitude: parseFloat(asset.Longitude),
            energy_unit: 'wattHour'
        });
    }

    return output;
};

const parseContent = path => {
    const inputContent = fs.readFileSync(path);

    return parse(inputContent, { columns: true, trim: true });
};

(async () => {
    console.log('----- Starting importing I-REC assets to local config file -----');

    const parsedContent = parseContent(program.input);

    console.log(`Found ${parsedContent.length} assets in ${program.input}`);

    const output = await processAssets(parsedContent);

    console.log(output);
})();
