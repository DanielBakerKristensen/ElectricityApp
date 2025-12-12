const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/settings/metering-points';

async function testValidation() {
    console.log('🧪 Testing Metering Point Validation...');

    // Test Case 1: Short ID (should fail)
    try {
        console.log('Test 1: Sending short ID (10 digits)...');
        await axios.post(BASE_URL, {
            name: 'Invalid Meter',
            meteringPointId: '1234567890'
        });
        console.error('❌ Failed! API accepted short ID.');
    } catch (error) {
        if (error.response && error.response.status === 400 && error.response.data.error.includes('18 digits')) {
            console.log('✅ Success! API rejected short ID.');
        } else {
            console.error('❌ Failed! Unexpected error:', error.message, error.response?.data);
        }
    }

    // Test Case 2: Non-numeric ID (should fail)
    try {
        console.log('Test 2: Sending non-numeric ID...');
        await axios.post(BASE_URL, {
            name: 'Invalid Meter',
            meteringPointId: '12345678901234567a'
        });
        console.error('❌ Failed! API accepted non-numeric ID.');
    } catch (error) {
        if (error.response && error.response.status === 400 && error.response.data.error.includes('digits')) {
            console.log('✅ Success! API rejected non-numeric ID.');
        } else {
            console.error('❌ Failed! Unexpected error:', error.message, error.response?.data);
        }
    }

    // Test Case 3: Valid ID with whitespace (should succeed if supported or fail length check depending on when trim validation happens - we trim first)
    // Actually, if we trim first, then a valid ID with spaces should pass if it becomes 18 digits.
    const validId = '123456789012345678';
    try {
        console.log('Test 3: Sending valid ID with whitespace...');
        // We can't really save this because it might be valid format but fake data. 
        // But the API doesn't validate existence against Eloverblik on save, only format.
        // So this should return 201.
        const res = await axios.post(BASE_URL, {
            name: 'Valid Meter via Script',
            meteringPointId: `  ${validId}  `
        });

        if (res.status === 201 && res.data.meteringPointId === validId) {
            console.log('✅ Success! API accepted and trimmed valid ID.');
            // Cleanup
            const newId = res.data.id;
            await axios.delete(`${BASE_URL}/${newId}`);
            console.log('🧹 Cleaned up test record.');
        } else {
            console.error('❌ Failed! API response unexpected:', res.status, res.data);
        }
    } catch (error) {
        console.error('❌ Failed! API rejected valid ID with whitespace:', error.message, error.response?.data);
    }
}

testValidation();
