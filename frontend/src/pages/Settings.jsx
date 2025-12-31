import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Switch,
    FormControlLabel,
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Divider,
    Alert,
    CircularProgress,
    Grid
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import KeyIcon from '@mui/icons-material/Key';
import ElectricMeterIcon from '@mui/icons-material/ElectricMeter';

const Settings = () => {
    const [tokens, setTokens] = useState([]);
    const [meteringPoints, setMeteringPoints] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Dialog states
    const [openTokenDialog, setOpenTokenDialog] = useState(false);
    const [openMpDialog, setOpenMpDialog] = useState(false);

    // Form state
    const [newTokenName, setNewTokenName] = useState('');
    const [newTokenValue, setNewTokenValue] = useState('');
    const [newMpName, setNewMpName] = useState('');
    const [newMpValue, setNewMpValue] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tokensRes, mpsRes] = await Promise.all([
                fetch('/api/settings/tokens'),
                fetch('/api/settings/metering-points')
            ]);

            if (!tokensRes.ok || !mpsRes.ok) throw new Error('Failed to fetch settings');

            const tokensData = await tokensRes.json();
            const mpsData = await mpsRes.json();

            setTokens(tokensData);
            setMeteringPoints(mpsData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Token Handlers ---

    const handleAddToken = async () => {
        try {
            const response = await fetch('/api/settings/tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newTokenName,
                    token: newTokenValue
                })
            });

            if (!response.ok) throw new Error('Failed to create token');

            setOpenTokenDialog(false);
            setNewTokenName('');
            setNewTokenValue('');
            fetchData();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteToken = async (id) => {
        if (!window.confirm('Delete this token?')) return;
        try {
            const response = await fetch(`/api/settings/tokens/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete token');
            fetchData();
        } catch (err) {
            setError(err.message);
        }
    };

    // --- Metering Point Handlers ---

    const handleAddMp = async () => {
        try {
            const response = await fetch('/api/settings/metering-points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newMpName,
                    meteringPointId: newMpValue
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to create metering point (${response.status})`);
            }

            setOpenMpDialog(false);
            setNewMpName('');
            setNewMpValue('');
            fetchData();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteMp = async (id) => {
        if (!window.confirm('Delete this metering point?')) return;
        try {
            const response = await fetch(`/api/settings/metering-points/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete metering point');
            fetchData();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                Settings
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Refresh Tokens Section */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Box display="flex" alignItems="center">
                                    <KeyIcon sx={{ mr: 1, color: 'primary.main' }} />
                                    <Typography variant="h6">Refresh Tokens</Typography>
                                </Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => setOpenTokenDialog(true)}
                                >
                                    Add
                                </Button>
                            </Box>

                            {loading ? <CircularProgress size={24} /> : (
                                <List dense>
                                    {tokens.map((token, index) => (
                                        <React.Fragment key={token.id}>
                                            {index > 0 && <Divider />}
                                            <ListItem>
                                                <ListItemText
                                                    primary={token.name}
                                                    secondary={token.token} // Masked from backend
                                                />
                                                <ListItemSecondaryAction>
                                                    <IconButton edge="end" onClick={() => handleDeleteToken(token.id)}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                        </React.Fragment>
                                    ))}
                                    {tokens.length === 0 && (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                            No tokens saved.
                                        </Typography>
                                    )}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Metering Points Section */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Box display="flex" alignItems="center">
                                    <ElectricMeterIcon sx={{ mr: 1, color: 'secondary.main' }} />
                                    <Typography variant="h6">Metering Points</Typography>
                                </Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => setOpenMpDialog(true)}
                                >
                                    Add
                                </Button>
                            </Box>

                            {loading ? <CircularProgress size={24} /> : (
                                <List dense>
                                    {meteringPoints.map((mp, index) => (
                                        <React.Fragment key={mp.id}>
                                            {index > 0 && <Divider />}
                                            <ListItem>
                                                <ListItemText
                                                    primary={mp.name}
                                                    secondary={mp.meteringPointId}
                                                />
                                                <ListItemSecondaryAction>
                                                    <IconButton edge="end" onClick={() => handleDeleteMp(mp.id)}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                        </React.Fragment>
                                    ))}
                                    {meteringPoints.length === 0 && (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                            No metering points saved.
                                        </Typography>
                                    )}
                                </List>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

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

            {/* Add Token Dialog */}
            <Dialog open={openTokenDialog} onClose={() => setOpenTokenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Refresh Token</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name (e.g. My House)"
                        fullWidth
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Refresh Token String"
                        fullWidth
                        multiline
                        rows={3}
                        value={newTokenValue}
                        onChange={(e) => setNewTokenValue(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenTokenDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddToken} variant="contained" disabled={!newTokenName || !newTokenValue}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Metering Point Dialog */}
            <Dialog open={openMpDialog} onClose={() => setOpenMpDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Metering Point</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name (e.g. Main Meter)"
                        fullWidth
                        value={newMpName}
                        onChange={(e) => setNewMpName(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Metering Point ID"
                        fullWidth
                        value={newMpValue}
                        onChange={(e) => setNewMpValue(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenMpDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddMp} variant="contained" disabled={!newMpName || !newMpValue}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Settings;
