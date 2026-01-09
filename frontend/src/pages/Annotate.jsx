import { useState } from 'react';
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
    DialogActions
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
    const [annotations, setAnnotations] = useState([
        {
            id: 1,
            title: 'Family Visit',
            description: 'Extended family stayed for the weekend, increased heating and cooking usage.',
            category: 'guests',
            date: '2024-12-15',
            dateRange: false
        },
        {
            id: 2,
            title: 'New Dishwasher',
            description: 'Installed energy-efficient dishwasher, should see reduction in consumption.',
            category: 'appliance',
            date: '2024-12-10',
            dateRange: false
        }
    ]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAnnotation, setEditingAnnotation] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'general',
        date: new Date(),
        dateRange: false
    });

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

    const handleSaveAnnotation = () => {
        const newAnnotation = {
            id: editingAnnotation ? editingAnnotation.id : Date.now(),
            title: formData.title,
            description: formData.description,
            category: formData.category,
            date: formData.date.toISOString().split('T')[0],
            dateRange: formData.dateRange
        };

        if (editingAnnotation) {
            setAnnotations(annotations.map(a => a.id === editingAnnotation.id ? newAnnotation : a));
        } else {
            setAnnotations([...annotations, newAnnotation]);
        }

        setDialogOpen(false);
    };

    const handleDeleteAnnotation = (id) => {
        setAnnotations(annotations.filter(a => a.id !== id));
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
                    Annotation features are in development. This page will allow you to add contextual notes to specific dates or periods in your consumption data.
                </Alert>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6">
                        Your Annotations ({annotations.length})
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddAnnotation}
                    >
                        Add Annotation
                    </Button>
                </Box>

                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        {annotations.length === 0 ? (
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