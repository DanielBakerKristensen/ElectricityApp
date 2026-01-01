import React from 'react';
import {
    Box,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack,
    useTheme,
    useMediaQuery
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import RefreshIcon from '@mui/icons-material/Refresh';
import CircularProgress from '@mui/material/CircularProgress';

const AnalysisToolbar = ({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onRefresh,
    loading,
    chartType,
    onChartTypeChange,
    comparisonMode,
    onComparisonModeChange,
    properties = [],
    selectedPropertyId,
    onPropertyChange,
    selectedMpId,
    onMpChange
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const selectedProperty = properties.find(p => Number(p.id) === Number(selectedPropertyId));
    const availableMps = selectedProperty?.meteringPoints || [];

    return (
        <Box
            sx={{
                p: 2,
                mb: 3,
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider'
            }}
        >
            <Stack
                direction={isMobile ? 'column' : 'row'}
                spacing={2}
                alignItems={isMobile ? 'stretch' : 'center'}
                flexWrap="wrap"
            >
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Property</InputLabel>
                    <Select
                        value={selectedPropertyId || ''}
                        label="Property"
                        onChange={onPropertyChange}
                    >
                        {properties.map(p => (
                            <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }} disabled={!selectedPropertyId}>
                    <InputLabel>Meter</InputLabel>
                    <Select
                        value={selectedMpId || ''}
                        label="Meter"
                        onChange={onMpChange}
                    >
                        {availableMps.map(mp => (
                            <MenuItem key={mp.id} value={mp.id}>{mp.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={onStartDateChange}
                    maxDate={new Date()}
                    format="dd/MM/yyyy"
                    slotProps={{ textField: { size: 'small', fullWidth: isMobile } }}
                />
                <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={onEndDateChange}
                    minDate={startDate}
                    maxDate={new Date()}
                    format="dd/MM/yyyy"
                    slotProps={{ textField: { size: 'small', fullWidth: isMobile } }}
                />

                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Chart Type</InputLabel>
                    <Select
                        value={chartType}
                        label="Chart Type"
                        onChange={onChartTypeChange}
                    >
                        <MenuItem value="candlestick">Candlestick (Daily)</MenuItem>
                        <MenuItem value="bar">Bar (Hourly)</MenuItem>
                        <MenuItem value="line">Line (Trend)</MenuItem>
                    </Select>
                </FormControl>

                <Box sx={{ flexGrow: 1 }} />

                <Button
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                    onClick={onRefresh}
                    disabled={loading}
                    fullWidth={isMobile}
                >
                    {loading ? 'Loading...' : 'Refresh Data'}
                </Button>
            </Stack>
        </Box>
    );
};

export default AnalysisToolbar;
