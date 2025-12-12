require('dotenv').config();
const { sequelize } = require('./config/database');
const MeteringPoint = require('./models/MeteringPoint');
const { Op } = require('sequelize');

async function cleanupBadData() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected.');

        console.log('🔍 Scanning for invalid Metering Points...');
        const allPoints = await MeteringPoint.findAll();

        let deletedCount = 0;

        for (const mp of allPoints) {
            const id = mp.id;
            const mpId = mp.meteringPointId;
            let isValid = true;
            let reason = '';

            if (mpId.trim().length !== 18) {
                isValid = false;
                reason = `Length is ${mpId.trim().length} (expected 18)`;
            } else if (!/^\d+$/.test(mpId.trim())) {
                isValid = false;
                reason = 'Contains non-digits';
            }

            if (!isValid) {
                console.log(`❌ Found invalid Metering Point (ID: ${id}, Val: '${mpId}'): ${reason}`);
                console.log(`   Deleting ID ${id}...`);
                await MeteringPoint.destroy({ where: { id } });
                deletedCount++;
            } else {
                // Optional: Check if it needs trimming
                if (mpId !== mpId.trim()) {
                    console.log(`⚠️  Found untrimmed valid Metering Point (ID: ${id}). Trimming...`);
                    await mp.update({ meteringPointId: mpId.trim() });
                    console.log('   Fixed.');
                }
            }
        }

        console.log('---------------------------');
        console.log(`Cleanup complete. Deleted ${deletedCount} invalid records.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

cleanupBadData();
