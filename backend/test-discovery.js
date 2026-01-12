const eloverblikService = require('./services/eloverblik-service');
const logger = require('./utils/logger');

async function testDiscovery() {
    const refreshToken = process.env.TEST_REFRESH_TOKEN;
    if (!refreshToken) {
        console.error('TEST_REFRESH_TOKEN env var is required');
        process.exit(1);
    }

    try {
        console.log('Testing metering point discovery...');
        const points = await eloverblikService.getMeteringPoints(refreshToken);
        console.log('Discovered points:', JSON.stringify(points, null, 2));

        if (points && points.length > 0) {
            console.log('SUCCESS: Discovery works!');
        } else {
            console.log('WARNING: No points found, but API call succeeded. Check if token has permissions.');
        }
    } catch (error) {
        console.error('FAILED: Discovery failed:', error.message);
    }
}

testDiscovery();
