import { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Grid,
    Typography,
    Button,
    Alert,
    TextField,
    Chip,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EventIcon from '@mui/icons-material/Event';
import HomeIcon from '@mui/icons-material/Home';
import DevicesIcon from '@mui/icons-material/Devices';
import CloudIcon from '@mui/icons-material/Cloud';
import RefreshIcon from '@mui/icons-material/Refresh';
import { authFetch } from '../utils/api';
import { useProperty } from '../context/PropertyContext';

const AnnotationCard = ({ annotation, onEdit, onDelete }) => {
    const getCategoryIcon = (category) => {
        switch (category) {
            case 'vacation': return <EventIcon />;
            case 'guests': return <HomeIcon />;
            case 'appliance': return <DevicesIcon />;
            case 'weather': return <CloudIcon />;
            default: return <EditNoteIcon />;
        }
    };

    const getCategoryColor = (category) => {
        switch (category) {
            case 'vacation': return 'primary';
            case 'guests': return 'secondary';
            case 'appliance': return 'warning';
            case 'weather': return 'info';
            default: return 'default';
        }
    };

    return (
        <Card sx={{ mb: 2 }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                            {annotation.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            {annotation.description}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                            <Chip
                                icon={getCategoryIcon(annotation.category)}
                                label={annotation.category}
                                color={getCategoryColor(annotation.category)}
                                size="small"
                            />
                            <Chip
                                label={annotation.date}
                                variant="outlined"
                                size="small"
                            />
                        </Stack>
                    </Box>
                    <Box>
                        <IconButton size="small" onClick={() => onEdit(annotation)}>
                            <EditNoteIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => onDelete(annotation.id)} color="error">
                            <DeleteIcon />
                        </IconButton>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

const Annotate = () => {
    const [annotations, setAnnotations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAnnotation, setEditingAnnotation] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'general',
        date: new Date(),
        dateRange: false
    });

    const { selectedMeetingPoint, loading: contextLoading } = useProperty();

    // Fetch annotations when metering point changes
    useEffect(() => {
        if (selectedMeetingPoint) {
            fetchAnnotations();
        } else {
            setAnnotations([]);
        }
    }, [selectedMeetingPoint]);

    const fetchAnnotations = async () => {
        if (!selectedMeetingPoint) return;

        setLoading(true);
        setError(null);

        try {
            const response = await authFetch(
                `/api/annotations?meteringPointId=${selectedMeetingPoint.id}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                setAnnotations(data.annotations || []);
            } else {
                throw new Error(data.error || 'Failed to fetch annotations');
            }
        } catch (err) {
            console.error('Error fetching annotations:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAnnotation = () => {
        setEditingAnnotation(null);
        setFormData({
            title: '',
            description: '',
            category: 'general',
            date: new Date(),
            dateRange: false
        });
        setDialogOpen(true);
    };

    const handleEditAnnotation = (annotation) => {
        setEditingAnnotation(annotation);
        setFormData({
            title: annotation.title,
            description: annotation.description,
            category: annotation.category,
            date: new Date(annotation.date),
            dateRange: annotation.dateRange
        });
        setDialogOpen(true);
    };

    const handleSaveAnnotation = async () => {
        if (!selectedMeetingPoint) {
            setError('Please select a metering point');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const payload = {
                title: formData.title,
                description: formData.description,
                category: formData.category,
                date: formData.date.toISOString().split('T')[0],
                dateRange: formData.dateRange,
                meteringPointId: selectedMeetingPoint.id
            };

            const method = editingAnnotation ? 'PUT' : 'POST';
            const endpoint = editingAnnotation 
                ? `/api/annotations/${editingAnnotation.id}`
                : '/api/annotations';

            const response = await authFetch(endpoint, {
                method,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to save annotation');
            }

            // Refresh annotations list
            await fetchAnnotations();
            setDialogOpen(false);
        } catch (err) {
            console.error('Error saving annotation:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAnnotation = async (id) => {
        if (!window.confirm('Are you sure you want to delete this annotation?')) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await authFetch(`/api/annotations/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to delete annotation');
            }

            // Refresh annotations list
            await fetchAnnotations();
        } catch (err) {
            console.error('Error deleting annotation:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Consumption Annotations
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Add context and notes to your consumption data to better understand usage patterns.
                    </Typography>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                    Annotations are stored per metering point. Select a metering point to view and manage annotations.
                </Alert>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6">
                        Your Annotations ({annotations.length})
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                            onClick={fetchAnnotations}
                            disabled={loading || contextLoading || !selectedMeetingPoint}
                        >
                            Refresh
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleAddAnnotation}
                            disabled={!selectedMeetingPoint}
                        >
                            Add Annotation
                        </Button>
                    </Stack>
                </Box>

                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        {loading ? (
                            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                <CircularProgress sx={{ mb: 2 }} />
                                <Typography variant="h6" gutterBottom>
                                    Loading Annotations...
                                </Typography>
                            </Box>
                        ) : !selectedMeetingPoint ? (
                            <Card>
                                <CardContent>
                                    <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                        <EditNoteIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                                        <Typography variant="h6" gutterBottom>
                                            No Metering Point Selected
                                        </Typography>
                                        <Typography variant="body2">
                                            Please select a metering point from the header to view and manage annotations.
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        ) : annotations.length === 0 ? (
                            <Card>
                                <CardContent>
                                    <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                        <EditNoteIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                                        <Typography variant="h6" gutterBottom>
                                            No Annotations Yet
                                        </Typography>
                                        <Typography variant="body2">
                                            Start adding notes to your consumption data to track events that affect your electricity usage.
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        ) : (
                            annotations.map(annotation => (
                                <AnnotationCard
                                    key={annotation.id}
                                    annotation={annotation}
                                    onEdit={handleEditAnnotation}
                                    onDelete={handleDeleteAnnotation}
                                />
                            ))
                        )}
                    </Grid>
                </Grid>
                {/* Add/Edit Annotation Dialog */}
                <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>
                        {editingAnnotation ? 'Edit Annotation' : 'Add New Annotation'}
                    </DialogTitle>
                    <DialogContent>
                        <Stack spacing={3} sx={{ mt: 1 }}>
                            <TextField
                                label="Title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                fullWidth
                                required
                            />
                            
                            <TextField
                                label="Description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                fullWidth
                                multiline
                                rows={3}
                            />

                            <FormControl fullWidth>
                                <InputLabel>Category</InputLabel>
                                <Select
                                    value={formData.category}
                                    label="Category"
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    <MenuItem value="general">General</MenuItem>
                                    <MenuItem value="vacation">Vacation</MenuItem>
                                    <MenuItem value="guests">Guests</MenuItem>
                                    <MenuItem value="appliance">Appliance Change</MenuItem>
                                    <MenuItem value="weather">Weather Event</MenuItem>
                                </Select>
                            </FormControl>

                            <DatePicker
                                label="Date"
                                value={formData.date}
                                onChange={(date) => setFormData({ ...formData, date })}
                                maxDate={new Date()}
                                format="dd/MM/yyyy"
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={handleSaveAnnotation} 
                            variant="contained"
                            disabled={!formData.title}
                        >
                            {editingAnnotation ? 'Update' : 'Add'} Annotation
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </LocalizationProvider>
    );
};

export default Annotate;