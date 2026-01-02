import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import KeyIcon from '@mui/icons-material/Key';
import ElectricMeterIcon from '@mui/icons-material/ElectricMeter';
import HomeIcon from '@mui/icons-material/Home';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { authFetch, setAdminToken as saveGlobalToken } from '../utils/api';

const Settings = () => {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedProperty, setExpandedProperty] = useState(null);

    // Dialog states
    const [openPropertyDialog, setOpenPropertyDialog] = useState(false);
    const [openMpDialog, setOpenMpDialog] = useState(false);
    const [editingProperty, setEditingProperty] = useState(null);
    const [activePropertyId, setActivePropertyId] = useState(null);

    // Form state
    const [propName, setPropName] = useState('');
    const [propToken, setPropToken] = useState('');
    const [propLat, setPropLat] = useState('');
    const [propLng, setPropLng] = useState('');
    const [propWeatherEnabled, setPropWeatherEnabled] = useState(true);

    const [newMpName, setNewMpName] = useState('');
    const [newMpValue, setNewMpValue] = useState('');

    // Security state
    const [adminTokenInput, setAdminTokenInput] = useState(localStorage.getItem('admin_token') || '');
    const [showToken, setShowToken] = useState(false);

    const handleSaveToken = () => {
        saveGlobalToken(adminTokenInput);
        fetchProperties();
    };

    useEffect(() => {
        fetchProperties();
    }, []);

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const response = await authFetch('/api/settings/properties');
            if (!response.ok) throw new Error('Failed to fetch properties');
            const data = await response.json();
            setProperties(data);

            // Auto-expand first property if none expanded
            if (data.length > 0 && expandedProperty === null) {
                setExpandedProperty(data[0].id);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Property Handlers ---

    const handleSaveProperty = async () => {
        try {
            const method = editingProperty ? 'PUT' : 'POST';
            const url = editingProperty
                ? `/api/settings/properties/${editingProperty.id}`
                : '/api/settings/properties';

            const response = await authFetch(url, {
                method,
                body: JSON.stringify({
                    name: propName,
                    refresh_token: propToken,
                    latitude: propLat || null,
                    longitude: propLng || null,
                    weather_sync_enabled: propWeatherEnabled
                })
            });

            if (!response.ok) throw new Error('Failed to save property');

            setOpenPropertyDialog(false);
            resetPropForm();
            fetchProperties();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteProperty = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Delete this property and all its metering points?')) return;
        try {
            const response = await fetch(`/api/settings/properties/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete property');
            fetchProperties();
        } catch (err) {
            setError(err.message);
        }
    };

    const openEditProperty = (prop, e) => {
        e.stopPropagation();
        setEditingProperty(prop);
        setPropName(prop.name);
        setPropToken(prop.refresh_token || '');
        setPropLat(prop.latitude || '');
        setPropLng(prop.longitude || '');
        setPropWeatherEnabled(prop.weather_sync_enabled);
        setOpenPropertyDialog(true);
    };

    const resetPropForm = () => {
        setEditingProperty(null);
        setPropName('');
        setPropToken('');
        setPropLat('');
        setPropLng('');
        setPropWeatherEnabled(true);
    };

    // --- Metering Point Handlers ---

    const handleAddMp = async () => {
        try {
            const response = await authFetch(`/api/settings/properties/${activePropertyId}/metering-points`, {
                method: 'POST',
                body: JSON.stringify({
                    name: newMpName,
                    meteringPointId: newMpValue
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to add metering point');
            }

            setOpenMpDialog(false);
            setNewMpName('');
            setNewMpValue('');
            fetchProperties();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteMp = async (mpId) => {
        if (!window.confirm('Delete this metering point?')) return;
        try {
            const response = await fetch(`/api/settings/metering-points/${mpId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete metering point');
            fetchProperties();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    Settings
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => { resetPropForm(); setOpenPropertyDialog(true); }}
                >
                    Add Property
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {loading && properties.length === 0 ? (
                <Box display="flex" justifyContent="center" p={4}>
                    <CircularProgress />
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {properties.map((prop) => (
                        <Grid item xs={12} key={prop.id}>
                            <Card variant="outlined" sx={{ borderRadius: 2 }}>
                                <Box
                                    sx={{
                                        p: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        bgcolor: expandedProperty === prop.id ? 'action.hover' : 'inherit',
                                        '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                    onClick={() => setExpandedProperty(expandedProperty === prop.id ? null : prop.id)}
                                >
                                    <HomeIcon sx={{ mr: 2, color: 'primary.main' }} />
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                                            {prop.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {prop.meteringPoints?.length || 0} Metering Points • {prop.weather_sync_enabled ? 'Weather Sync On' : 'Weather Sync Off'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Tooltip title="Edit Property">
                                            <IconButton onClick={(e) => openEditProperty(prop, e)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete Property">
                                            <IconButton onClick={(e) => handleDeleteProperty(prop.id, e)} color="error">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <IconButton size="small">
                                            {expandedProperty === prop.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                        </IconButton>
                                    </Box>
                                </Box>

                                <Collapse in={expandedProperty === prop.id}>
                                    <Divider />
                                    <CardContent sx={{ bgcolor: 'background.default' }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                                                <ElectricMeterIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                                                Metering Points
                                            </Typography>
                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => { setActivePropertyId(prop.id); setOpenMpDialog(true); }}
                                            >
                                                Add Meter
                                            </Button>
                                        </Box>

                                        <Paper variant="outlined">
                                            <List dense>
                                                {prop.meteringPoints?.map((mp, idx) => (
                                                    <React.Fragment key={mp.id}>
                                                        {idx > 0 && <Divider />}
                                                        <ListItem>
                                                            <ListItemText
                                                                primary={mp.name}
                                                                secondary={mp.meteringPointId}
                                                            />
                                                            <ListItemSecondaryAction>
                                                                <IconButton edge="end" size="small" onClick={() => handleDeleteMp(mp.id)}>
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </ListItemSecondaryAction>
                                                        </ListItem>
                                                    </React.Fragment>
                                                ))}
                                                {(!prop.meteringPoints || prop.meteringPoints.length === 0) && (
                                                    <ListItem>
                                                        <ListItemText
                                                            secondary="No metering points added yet."
                                                            sx={{ fontStyle: 'italic' }}
                                                        />
                                                    </ListItem>
                                                )}
                                            </List>
                                        </Paper>

                                        <Box sx={{ mt: 3 }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Configuration Details
                                            </Typography>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={6}>
                                                    <Typography variant="caption" display="block">REFRESH TOKEN</Typography>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'action.disabledBackground', p: 0.5, borderRadius: 1 }}>
                                                        {prop.refresh_token || 'None'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={3}>
                                                    <Typography variant="caption" display="block">COORDINATES</Typography>
                                                    <Typography variant="body2">
                                                        {prop.latitude && prop.longitude ? `${prop.latitude}, ${prop.longitude}` : 'Not set'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={3}>
                                                    <Typography variant="caption" display="block">WEATHER SYNC</Typography>
                                                    <Typography variant="body2" color={prop.weather_sync_enabled ? 'success.main' : 'text.disabled'}>
                                                        {prop.weather_sync_enabled ? 'Enabled' : 'Disabled'}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </Box>
                                    </CardContent>
                                </Collapse>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Card sx={{ mt: 4, borderRadius: 2 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                        <KeyIcon sx={{ mr: 1 }} />
                        Security Settings
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Set your Admin Token to manage properties and trigger syncs. This is stored locally in your browser.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                            size="small"
                            label="Admin Token"
                            type={showToken ? "text" : "password"}
                            value={adminTokenInput}
                            onChange={(e) => setAdminTokenInput(e.target.value)}
                            sx={{ flexGrow: 1 }}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowToken(!showToken)} edge="end">
                                            {showToken ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<SaveIcon />}
                            onClick={handleSaveToken}
                        >
                            Save Token
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            <Card sx={{ mt: 4, borderRadius: 2 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Application Settings
                    </Typography>
                    <FormControlLabel
                        control={<Switch defaultChecked />}
                        label="Dark Mode"
                    />
                </CardContent>
            </Card>

            {/* Property Add/Edit Dialog */}
            <Dialog open={openPropertyDialog} onClose={() => setOpenPropertyDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus margin="dense" label="Property Name (e.g. Summer House)"
                        fullWidth value={propName} onChange={(e) => setPropName(e.target.value)}
                        sx={{ mb: 2, mt: 1 }}
                    />
                    <TextField
                        margin="dense" label="Eloverblik Refresh Token"
                        fullWidth multiline rows={2} value={propToken} onChange={(e) => setPropToken(e.target.value)}
                        placeholder="eyJhbGciOi..."
                        sx={{ mb: 2 }}
                    />
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <TextField
                                label="Latitude" fullWidth value={propLat}
                                onChange={(e) => setPropLat(e.target.value)}
                                placeholder="55.1234"
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Longitude" fullWidth value={propLng}
                                onChange={(e) => setPropLng(e.target.value)}
                                placeholder="10.5678"
                            />
                        </Grid>
                    </Grid>
                    <Box sx={{ mt: 2 }}>
                        <FormControlLabel
                            control={<Switch checked={propWeatherEnabled} onChange={(e) => setPropWeatherEnabled(e.target.checked)} />}
                            label="Enable Weather Sync"
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={() => setOpenPropertyDialog(false)}>Cancel</Button>
                    <Button onClick={handleSaveProperty} variant="contained" disabled={!propName}>
                        Save Property
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Metering Point Dialog */}
            <Dialog open={openMpDialog} onClose={() => setOpenMpDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Add Metering Point</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus margin="dense" label="Meter Name (e.g. Main Kitchen)"
                        fullWidth value={newMpName} onChange={(e) => setNewMpName(e.target.value)}
                        sx={{ mb: 2, mt: 1 }}
                    />
                    <TextField
                        margin="dense" label="18-digit Metering Point ID"
                        fullWidth value={newMpValue} onChange={(e) => setNewMpValue(e.target.value)}
                        inputProps={{ maxLength: 18 }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={() => setOpenMpDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddMp} variant="contained" disabled={!newMpName || newMpValue.length !== 18}>
                        Add Meter
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Settings;
