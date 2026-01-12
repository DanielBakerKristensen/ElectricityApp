import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Card,
    CardContent,
    Stepper,
    Step,
    StepLabel,
    Button,
    Typography,
    TextField,
    Alert,
    Grid,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    IconButton,
    Divider
} from '@mui/material';
import {
    Home,
    Key,
    ElectricMeter,
    LocationOn,
    CheckCircle,
    ArrowBack,
    ArrowForward,
    DeleteOutline,
    AddCircle,
    Refresh,
    Warning
} from '@mui/icons-material';
import { CircularProgress, Checkbox } from '@mui/material';
import { authFetch } from '../utils/api';

const steps = ['Welcome', 'Property Info', 'El-overblik Token', 'Metering Points', 'Coordinates', 'Review'];

const PropertyWizard = ({ onComplete, onSkip }) => {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [propertyData, setPropertyData] = useState({
        name: '',
        address: '',
        refreshToken: '',
        latitude: '',
        longitude: '',
        meteringPoints: [{ name: '', meteringPointId: '' }]
    });

    const [isValidating, setIsValidating] = useState(false);
    const [discoveredMeteringPoints, setDiscoveredMeteringPoints] = useState([]);
    const [tokenValidated, setTokenValidated] = useState(false);
    const [validationResult, setValidationResult] = useState(null);

    const handleNext = () => {
        setError('');

        // Validation for each step
        if (activeStep === 1) {
            if (!propertyData.name.trim()) {
                setError('Property name is required');
                return;
            }
        }

        if (activeStep === 2) {
            if (!propertyData.refreshToken.trim()) {
                setError('El-overblik refresh token is required');
                return;
            }
            if (!tokenValidated) {
                setError('Please validate your token before proceeding');
                return;
            }
        }

        if (activeStep === 3) {
            const validPoints = propertyData.meteringPoints.filter(mp =>
                mp.meteringPointId.trim().length === 18
            );
            if (validPoints.length === 0) {
                setError('At least one valid 18-digit metering point ID is required');
                return;
            }
        }

        if (activeStep === 4) {
            if (propertyData.latitude && (parseFloat(propertyData.latitude) < -90 || parseFloat(propertyData.latitude) > 90)) {
                setError('Latitude must be between -90 and 90');
                return;
            }
            if (propertyData.longitude && (parseFloat(propertyData.longitude) < -180 || parseFloat(propertyData.longitude) > 180)) {
                setError('Longitude must be between -180 and 180');
                return;
            }
        }

        setActiveStep((prevStep) => prevStep + 1);
    };

    const handleBack = () => {
        setError('');
        setActiveStep((prevStep) => prevStep - 1);
    };

    const handleChange = (field, value) => {
        setPropertyData({ ...propertyData, [field]: value });
        setError('');
    };

    const handleMeteringPointChange = (index, field, value) => {
        const newPoints = [...propertyData.meteringPoints];
        newPoints[index][field] = value;
        setPropertyData({ ...propertyData, meteringPoints: newPoints });
        setError('');
    };

    const handleValidateToken = async () => {
        if (!propertyData.refreshToken.trim()) {
            setError('Please enter a refresh token');
            return;
        }

        setIsValidating(true);
        setError('');
        try {
            const response = await authFetch('/api/settings/validate-token', {
                method: 'POST',
                body: JSON.stringify({ refresh_token: propertyData.refreshToken })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to validate token');
            }

            const points = await response.json();
            setValidationResult(points);
            setDiscoveredMeteringPoints(points.result || []);
            setTokenValidated(true);

            // Automatically populate metering points if discovered
            if (points && points.result && points.result.length > 0) {
                const newPoints = points.result.map(p => ({
                    name: p.type === 'E17' ? 'Consumption' : (p.type === 'E18' ? 'Production' : 'Meter'),
                    meteringPointId: p.meteringPointId
                }));
                setPropertyData(prev => ({ ...prev, meteringPoints: newPoints }));
            }
        } catch (err) {
            setError(err.message);
            setTokenValidated(false);
        } finally {
            setIsValidating(false);
        }
    };

    const addMeteringPoint = () => {
        setPropertyData({
            ...propertyData,
            meteringPoints: [...propertyData.meteringPoints, { name: '', meteringPointId: '' }]
        });
    };

    const removeMeteringPoint = (index) => {
        if (propertyData.meteringPoints.length > 1) {
            const newPoints = propertyData.meteringPoints.filter((_, i) => i !== index);
            setPropertyData({ ...propertyData, meteringPoints: newPoints });
        }
    };

    const handleSubmit = async () => {
        setError('');
        setLoading(true);

        try {
            // Create property
            const propertyResponse = await authFetch('/api/settings/properties', {
                method: 'POST',
                body: JSON.stringify({
                    name: propertyData.name,
                    address: propertyData.address || null,
                    refresh_token: propertyData.refreshToken,
                    latitude: propertyData.latitude || null,
                    longitude: propertyData.longitude || null,
                    weather_sync_enabled: !!(propertyData.latitude && propertyData.longitude)
                })
            });

            if (!propertyResponse.ok) {
                throw new Error('Failed to create property');
            }

            const property = await propertyResponse.json();

            // Add metering points
            const validPoints = propertyData.meteringPoints.filter(mp =>
                mp.meteringPointId.trim().length === 18
            );

            for (const mp of validPoints) {
                const mpResponse = await authFetch(`/api/settings/properties/${property.id}/metering-points`, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: mp.name || 'Main Meter',
                        meteringPointId: mp.meteringPointId.trim()
                    })
                });

                if (!mpResponse.ok) {
                    console.error('Failed to add metering point:', mp);
                }
            }

            // Trigger initial 7-day sync
            try {
                await authFetch(`/api/settings/properties/${property.id}/sync-initial`, {
                    method: 'POST'
                });
            } catch (syncErr) {
                console.error('Failed to trigger initial sync:', syncErr);
                // We don't block the wizard completion for background sync failure
            }

            // Call completion callback 
            if (onComplete) {
                onComplete();
            } else {
                navigate('/');
            }

        } catch (err) {
            setError(err.message || 'Failed to create property');
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (activeStep) {
            case 0: // Welcome
                return (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Home sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
                        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Welcome to Property Setup!
                        </Typography>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            Let's set up your first property to start tracking electricity consumption.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            This wizard will guide you through:
                        </Typography>
                        <Box sx={{ mt: 3 }}>
                            <Grid container spacing={2} justifyContent="center">
                                <Grid item xs={12} sm={6} md={3}>
                                    <Paper elevation={1} sx={{ p: 2 }}>
                                        <Home color="primary" />
                                        <Typography variant="caption" display="block">Property Details</Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Paper elevation={1} sx={{ p: 2 }}>
                                        <Key color="primary" />
                                        <Typography variant="caption" display="block">API Token</Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Paper elevation={1} sx={{ p: 2 }}>
                                        <ElectricMeter color="primary" />
                                        <Typography variant="caption" display="block">Meter ID</Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Paper elevation={1} sx={{ p: 2 }}>
                                        <LocationOn color="primary" />
                                        <Typography variant="caption" display="block">Location</Typography>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </Box>
                        {onSkip && (
                            <Button
                                variant="text"
                                onClick={onSkip}
                                sx={{ mt: 4 }}
                            >
                                Skip for now, I'll set up manually later
                            </Button>
                        )}
                    </Box>
                );

            case 1: // Property Info
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                            Property Information
                        </Typography>
                        <TextField
                            fullWidth
                            required
                            label="Property Name"
                            placeholder="e.g., Summer House, Copenhagen Apartment"
                            value={propertyData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            margin="normal"
                            helperText="Give your property a descriptive name"
                        />
                        <TextField
                            fullWidth
                            label="Address (Optional)"
                            placeholder="e.g., Nyhavn 12, 1051 Copenhagen"
                            value={propertyData.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                            margin="normal"
                            helperText="Optional: Physical address of the property"
                        />
                    </Box>
                );

            case 2: // El-overblik Token
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                            El-overblik Refresh Token
                        </Typography>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography variant="body2" gutterBottom sx={{ fontWeight: 'medium' }}>
                                How to get your refresh token:
                            </Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText
                                        primary="1. Go to eloverblik.dk and log in"
                                        primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="2. Navigate to Settings → API"
                                        primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="3. Generate a new refresh token or copy your existing one"
                                        primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="4. Paste the token in the field below"
                                        primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                </ListItem>
                            </List>
                        </Alert>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <TextField
                                fullWidth
                                required
                                label="Refresh Token"
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                value={propertyData.refreshToken}
                                onChange={(e) => {
                                    handleChange('refreshToken', e.target.value);
                                    setTokenValidated(false);
                                }}
                                multiline
                                rows={3}
                                margin="normal"
                                helperText="Paste your el-overblik refresh token here"
                                error={!!error && !tokenValidated}
                            />
                            <Button
                                variant="outlined"
                                onClick={handleValidateToken}
                                disabled={isValidating || !propertyData.refreshToken.trim()}
                                sx={{ mt: 2, py: 1.5, minWidth: 120 }}
                                startIcon={isValidating ? <CircularProgress size={20} /> : (tokenValidated ? <CheckCircle color="success" /> : <Key />)}
                            >
                                {isValidating ? 'Validating...' : (tokenValidated ? 'Validated' : 'Validate')}
                            </Button>
                        </Box>
                        {tokenValidated && validationResult && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                                Token valid! Found {validationResult.result.length} metering point(s).
                                <List dense>
                                    {validationResult.result.map((mp, index) => (
                                        <ListItem key={index}>
                                            <ListItemText
                                                primary={`Metering Point: ${mp.meteringPointId}`}
                                                secondary={`Consumer: ${mp.consumerCVR || 'N/A'} - ${mp.firstConsumerPartyName || 'N/A'}`}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Alert>
                        )}
                    </Box>
                );

            case 3: // Metering Points
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                            Metering Points
                        </Typography>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography variant="body2">
                                {discoveredMeteringPoints.length > 0
                                    ? `We found ${discoveredMeteringPoints.length} metering point(s) associated with your token. You can edit them below or add more manually.`
                                    : 'Your metering point ID is an 18-digit number found on your electricity bill or in el-overblik.dk'}
                            </Typography>
                        </Alert>
                        {propertyData.meteringPoints.map((mp, index) => (
                            <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2, borderColor: mp.meteringPointId.length === 18 ? 'success.light' : 'divider' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="subtitle2">
                                            Meter #{index + 1}
                                        </Typography>
                                        {mp.meteringPointId.length === 18 && <CheckCircle color="success" sx={{ fontSize: 16 }} />}
                                    </Box>
                                    {propertyData.meteringPoints.length > 1 && (
                                        <IconButton size="small" onClick={() => removeMeteringPoint(index)} color="error">
                                            <DeleteOutline />
                                        </IconButton>
                                    )}
                                </Box>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={4}>
                                        <TextField
                                            fullWidth
                                            label="Name"
                                            placeholder="e.g., Main Kitchen"
                                            value={mp.name}
                                            onChange={(e) => handleMeteringPointChange(index, 'name', e.target.value)}
                                            margin="dense"
                                            size="small"
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={8}>
                                        <TextField
                                            fullWidth
                                            required
                                            label="18-digit Metering Point ID"
                                            placeholder="571313174012345678"
                                            value={mp.meteringPointId}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/\D/g, '').slice(0, 18);
                                                handleMeteringPointChange(index, 'meteringPointId', value);
                                            }}
                                            margin="dense"
                                            size="small"
                                            error={mp.meteringPointId && mp.meteringPointId.length !== 18}
                                            helperText={mp.meteringPointId && mp.meteringPointId.length !== 18 ? `${mp.meteringPointId.length}/18 digits` : '18 digits required'}
                                            inputProps={{ maxLength: 18 }}
                                        />
                                    </Grid>
                                </Grid>
                            </Paper>
                        ))}
                        <Button
                            startIcon={<AddCircle />}
                            onClick={addMeteringPoint}
                            variant="outlined"
                            fullWidth
                            sx={{ mt: 1 }}
                        >
                            Add Another Meter Manually
                        </Button>
                    </Box>
                );

            case 4: // Coordinates
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                            Property Location
                        </Typography>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography variant="body2">
                                Optional: Add coordinates for weather data integration. You can find these on Google Maps by right-clicking the location.
                            </Typography>
                        </Alert>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Latitude"
                                    placeholder="55.676098"
                                    value={propertyData.latitude}
                                    onChange={(e) => handleChange('latitude', e.target.value)}
                                    type="number"
                                    inputProps={{ step: 'any', min: -90, max: 90 }}
                                    helperText="Range: -90 to 90"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Longitude"
                                    placeholder="12.568337"
                                    value={propertyData.longitude}
                                    onChange={(e) => handleChange('longitude', e.target.value)}
                                    type="number"
                                    inputProps={{ step: 'any', min: -180, max: 180 }}
                                    helperText="Range: -180 to 180"
                                />
                            </Grid>
                        </Grid>
                    </Box>
                );

            case 5: // Review
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                            Review Your Property Setup
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 3 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="text.secondary">Property Name</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{propertyData.name}</Typography>
                                </Grid>
                                {propertyData.address && (
                                    <Grid item xs={12}>
                                        <Typography variant="subtitle2" color="text.secondary">Address</Typography>
                                        <Typography variant="body1">{propertyData.address}</Typography>
                                    </Grid>
                                )}
                                <Grid item xs={12}>
                                    <Divider />
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="text.secondary">Refresh Token</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                        {propertyData.refreshToken.substring(0, 20)}...
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Divider />
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Metering Points ({propertyData.meteringPoints.filter(mp => mp.meteringPointId.length === 18).length})
                                    </Typography>
                                    <List dense>
                                        {propertyData.meteringPoints
                                            .filter(mp => mp.meteringPointId.length === 18)
                                            .map((mp, index) => (
                                                <ListItem key={index}>
                                                    <ListItemIcon>
                                                        <CheckCircle color="success" fontSize="small" />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={mp.name || `Meter ${index + 1}`}
                                                        secondary={mp.meteringPointId}
                                                        secondaryTypographyProps={{ sx: { fontFamily: 'monospace' } }}
                                                    />
                                                </ListItem>
                                            ))}
                                    </List>
                                </Grid>
                                {(propertyData.latitude || propertyData.longitude) && (
                                    <>
                                        <Grid item xs={12}>
                                            <Divider />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Typography variant="subtitle2" color="text.secondary">Coordinates</Typography>
                                            <Typography variant="body2">
                                                {propertyData.latitude}, {propertyData.longitude}
                                            </Typography>
                                            <Typography variant="caption" color="success.main">
                                                ✓ Weather data will be enabled
                                            </Typography>
                                        </Grid>
                                    </>
                                )}
                            </Grid>
                        </Paper>
                    </Box>
                );

            default:
                return null;
        }
    };

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Card elevation={3}>
                <CardContent sx={{ p: 4 }}>
                    <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}

                    <Box sx={{ minHeight: 400 }}>
                        {renderStepContent()}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                        <Button
                            disabled={activeStep === 0}
                            onClick={handleBack}
                            startIcon={<ArrowBack />}
                        >
                            Back
                        </Button>

                        <Box>
                            {activeStep < steps.length - 1 ? (
                                <Button
                                    variant="contained"
                                    onClick={handleNext}
                                    endIcon={<ArrowForward />}
                                >
                                    Next
                                </Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    endIcon={<CheckCircle />}
                                >
                                    {loading ? 'Creating...' : 'Complete Setup'}
                                </Button>
                            )}
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </Container>
    );
};

export default PropertyWizard;
