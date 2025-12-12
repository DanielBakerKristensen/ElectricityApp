require('dotenv').config(); // Load .env file
const { sequelize } = require('./config/database');
const MeteringPoint = require('./models/MeteringPoint');

async function debugData() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected.');

        console.log('--- Environment Variables ---');
        const envMP = process.env.ELOVERBLIK_METERING_POINTS;
        console.log(`Env Metering Point: '${envMP}'`);
        if (envMP) {
            console.log('Length:', envMP.length);
        } else {
            console.log('Env var not found or empty');
        }
        console.log('-----------------------------');

        const id = 2; // The ID user complained about
        console.log(`Fetching MeteringPoint with ID ${id}...`);

        const mp = await MeteringPoint.findByPk(id);

        if (!mp) {
            console.log('MeteringPoint not found!');
        } else {
            console.log('--- MeteringPoint Found ---');
            console.log('ID:', mp.id);
            console.log('Name:', mp.name);
            console.log('Stored MeteringPointId:', `'${mp.meteringPointId}'`);
            console.log('Length:', mp.meteringPointId.length);
            console.log('Char codes:', mp.meteringPointId.split('').map(c => c.charCodeAt(0)));
            console.log('---------------------------');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

debugData();
