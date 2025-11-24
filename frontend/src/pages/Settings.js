import React from 'react';
import { Box, Typography, Card, CardContent, Switch, FormControlLabel } from '@mui/material';

const Settings = () => {
    return (
        <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                Settings
            </Typography>

            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Appearance
                    </Typography>
                    <FormControlLabel
                        control={<Switch defaultChecked />}
                        label="Dark Mode"
                    />
                </CardContent>
            </Card>

            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Data Preferences
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Configuration options for data fetching and display will appear here.
                    </Typography>
                </CardContent>
            </Card>
        </Box>
    );
};

export default Settings;
