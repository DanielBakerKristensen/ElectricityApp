import React from 'react';
import { FormControl, Select, MenuItem, Box, Typography, IconButton, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useProperty } from '../context/PropertyContext';
import { useAuth } from '../context/AuthContext';

const PropertySelector = () => {
    const {
        properties,
        selectedProperty,
        selectedMeetingPoint,
        setSelectedProperty,
        setSelectedMeetingPoint,
        saveAsDefault,
        loading
    } = useProperty();
    const { user } = useAuth();

    if (loading) {
        return <Typography variant="caption">Loading...</Typography>;
    }

    if (!properties || properties.length === 0) {
        return <Typography variant="caption" color="text.secondary">No properties found</Typography>;
    }

    return (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" variant="standard" sx={{ minWidth: 120 }}>
                <Select
                    value={selectedProperty?.id || ''}
                    onChange={(e) => setSelectedProperty(e.target.value)}
                    disableUnderline
                    sx={{
                        color: 'text.primary',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        '& .MuiSelect-select': { py: 0.5 }
                    }}
                >
                    {properties.map(p => (
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            {selectedProperty?.meteringPoints?.length > 0 && (
                <FormControl size="small" variant="standard" sx={{ minWidth: 120 }}>
                    <Select
                        value={selectedMeetingPoint?.id || ''}
                        onChange={(e) => setSelectedMeetingPoint(e.target.value)}
                        disableUnderline
                        sx={{
                            color: 'text.secondary',
                            fontSize: '0.875rem',
                            '& .MuiSelect-select': { py: 0.5 }
                        }}
                    >
                        {selectedProperty.meteringPoints.map(mp => (
                            <MenuItem key={mp.id} value={mp.id}>{mp.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            <Tooltip title="Set as default">
                <IconButton onClick={saveAsDefault} size="small" color="inherit">
                    {user?.defaultPropertyId === selectedProperty?.id &&
                        (!selectedProperty?.meteringPoints?.length || user?.defaultMeetingPointId === selectedMeetingPoint?.id)
                        ? <StarIcon fontSize="small" />
                        : <StarBorderIcon fontSize="small" />}
                </IconButton>
            </Tooltip>
        </Box>
    );
};

export default PropertySelector;
