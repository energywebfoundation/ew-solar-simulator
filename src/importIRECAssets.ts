import program from 'commander';
import parse from 'csv-parse/lib/sync';
import fs from 'fs';
import Web3 from 'web3';

import CONFIG from '../config/config.json';

const configLocation = 'config/config.json';
const web3 = new Web3(CONFIG.config.WEB3_URL);

program.option('-i, --input <path>', 'input I-REC csv file');

program.parse(process.argv);

if (!program.input) {
    console.error(`Missing -i argument`);
    process.exit(1);
}

if (!fs.existsSync(program.input)) {
    console.error(`${program.input} file does not exist`);
    process.exit(1);
}

const processAssets = async parsedContent => {
    const output = [];

    let id = 0;
    for (const asset of parsedContent) {
        console.log('---');
        console.log(`Processing ${asset['Device ID']} asset`);

        const maxCapacity = parseFloat(asset['Electrical Capacity (MW)']) * 10 ** 6;

        const account = web3.eth.accounts.create();

        console.log(`Generated smart meter address ${account.address}`);

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

    const assets = await processAssets(parsedContent);
    const updatedConfig = JSON.stringify({ ...CONFIG, assets }, null, 2);

    fs.writeFileSync(configLocation, updatedConfig);

    console.log(`----- New assets stored in ${configLocation}`);
})();
