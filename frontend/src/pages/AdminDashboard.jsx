import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Tabs,
    Tab,
    Alert,
    CircularProgress,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { authFetch } from '../utils/api';

const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [properties, setProperties] = useState([]);
    const [meteringPoints, setMeteringPoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tabValue, setTabValue] = useState(0);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteSuccess, setDeleteSuccess] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Get token for auth header if needed (though browser cookies should handle it)
            const headers = { 'Content-Type': 'application/json' };
            const fetchOptions = {
                headers
            };

            const [usersRes, propsRes, mpsRes] = await Promise.all([
                fetch('/api/admin/users', fetchOptions),
                fetch('/api/admin/properties', fetchOptions),
                fetch('/api/admin/metering-points', fetchOptions)
            ]);

            if (!usersRes.ok || !propsRes.ok || !mpsRes.ok) {
                if (usersRes.status === 403 || propsRes.status === 403 || mpsRes.status === 403) {
                    throw new Error("Access Denied: Admin privileges required");
                }
                throw new Error("Failed to fetch admin data");
            }

            const usersData = await usersRes.json();
            const propsData = await propsRes.json();
            const mpsData = await mpsRes.json();

            setUsers(usersData);
            setProperties(propsData);
            setMeteringPoints(mpsData);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const handleOpenConfirm = (user) => {
        setUserToDelete(user);
        setDeleteSuccess(false);
        setConfirmOpen(true);
    };

    const handleCloseConfirm = () => {
        setConfirmOpen(false);
        setUserToDelete(null);
        setDeleteSuccess(false);
    };

    const handleDeleteUser = async () => {
        if (!userToDelete || isDeleting) return;

        setIsDeleting(true);
        try {
            const response = await authFetch(`/api/admin/users/${userToDelete.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    throw new Error('Failed to delete user and could not parse error response.');
                }
                throw new Error(errorData.error || 'Failed to delete user');
            }

            setDeleteSuccess(true);
            setUsers(users.filter(u => u.id !== userToDelete.id));
            
            // Auto-close dialog after success
            setTimeout(() => {
                handleCloseConfirm();
            }, 2000);

        } catch (err) {
            setError(err.message);
            handleCloseConfirm();
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box p={3}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <>
        <Box p={3}>
            <Typography variant="h4" gutterBottom>
                Admin Dashboard
            </Typography>
            <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                System Overview
            </Typography>

            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Users
                            </Typography>
                            <Typography variant="h3">
                                {users.length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Properties
                            </Typography>
                            <Typography variant="h3">
                                {properties.length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Metering Points
                            </Typography>
                            <Typography variant="h3">
                                {meteringPoints.length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="admin tabs">
                    <Tab label="Users" />
                    <Tab label="Properties" />
                    <Tab label="Metering Points" />
                </Tabs>
            </Box>

            <div role="tabpanel" hidden={tabValue !== 0} id="tabpanel-0">
                {tabValue === 0 && (
                    <TableContainer component={Paper} sx={{ mt: 2 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Role</TableCell>
                                    <TableCell>Onboarding</TableCell>
                                    <TableCell>Created At</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.id}</TableCell>
                                        <TableCell>{user.name || '-'}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.is_admin ? 'Admin' : 'User'}
                                                color={user.is_admin ? 'error' : 'primary'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.onboarding_completed ? 'Done' : 'Pending'}
                                                color={user.onboarding_completed ? 'success' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell align="right">
                                            <IconButton onClick={() => handleOpenConfirm(user)} color="error" size="small">
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </div>

            <div role="tabpanel" hidden={tabValue !== 1} id="tabpanel-1">
                {tabValue === 1 && (
                    <TableContainer component={Paper} sx={{ mt: 2 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Owner</TableCell>
                                    <TableCell>Token (Masked)</TableCell>
                                    <TableCell>Metering Points</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {properties.map((prop) => (
                                    <TableRow key={prop.id}>
                                        <TableCell>{prop.id}</TableCell>
                                        <TableCell>{prop.name}</TableCell>
                                        <TableCell>
                                            {prop.users && prop.users.map(u => (
                                                <div key={u.id} style={{ fontSize: '0.8rem' }}>{u.email}</div>
                                            ))}
                                            {(!prop.users || prop.users.length === 0) && <span style={{ color: 'gray', fontStyle: 'italic' }}>No Owner</span>}
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {prop.refresh_token || '-'}
                                        </TableCell>
                                        <TableCell>{prop.meteringPoints ? prop.meteringPoints.length : 0}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </div>

            <div role="tabpanel" hidden={tabValue !== 2} id="tabpanel-2">
                {tabValue === 2 && (
                    <TableContainer component={Paper} sx={{ mt: 2 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>MP ID</TableCell>
                                    <TableCell>Property</TableCell>
                                    <TableCell>Owner</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {meteringPoints.map((mp) => (
                                    <TableRow key={mp.id}>
                                        <TableCell>{mp.id}</TableCell>
                                        <TableCell>{mp.name}</TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace' }}>{mp.meteringPointId}</TableCell>
                                        <TableCell>{mp.property ? mp.property.name : <span style={{ color: 'red' }}>Orphaned</span>}</TableCell>
                                        <TableCell>
                                            {mp.property && mp.property.users && mp.property.users.map(u => (
                                                <div key={u.id} style={{ fontSize: '0.8rem' }}>{u.email}</div>
                                            ))}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </div>
        </Box>
        <Dialog
    open={confirmOpen}
    onClose={handleCloseConfirm}
>
    <DialogTitle>Confirm Deletion</DialogTitle>
    <DialogContent>
        <DialogContentText>
            Are you sure you want to delete the user "{userToDelete?.email}"? This action is irreversible and will delete all associated properties, metering points, and data.
        </DialogContentText>
        {deleteSuccess && (
            <Box mt={2} p={2} sx={{ border: '1px solid #4caf50', borderRadius: 1, backgroundColor: '#f1f8e9' }}>
                <Typography variant="h6" color="success.main" sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircleIcon sx={{ mr: 1 }} />
                    User deleted successfully!
                </Typography>
            </Box>
        )}
    </DialogContent>
    <DialogActions>
        <Button onClick={handleCloseConfirm} disabled={isDeleting}>Cancel</Button>
        <Button onClick={handleDeleteUser} color="error" autoFocus disabled={isDeleting || deleteSuccess}>
            {isDeleting ? 'Deleting...' : deleteSuccess ? 'Deleted!' : 'Delete'}
        </Button>
    </DialogActions>
</Dialog>
    </>
    );
};

export default AdminDashboard;
