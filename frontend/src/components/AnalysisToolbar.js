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
    onComparisonModeChange
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
                <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={onStartDateChange}
                    slotProps={{ textField: { size: 'small', fullWidth: isMobile } }}
                />
                <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={onEndDateChange}
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

                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Comparison</InputLabel>
                    <Select
                        value={comparisonMode}
                        label="Comparison"
                        onChange={onComparisonModeChange}
                    >
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="day">Day vs Day</MenuItem>
                        <MenuItem value="week">Week vs Week</MenuItem>
                        <MenuItem value="month">Month vs Month</MenuItem>
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
