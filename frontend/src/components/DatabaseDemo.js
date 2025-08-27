import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './ApiDemo.css';

const DatabaseDemo = () => {
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dateRange, setDateRange] = useState({});

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Calculate date range (7 days ago to yesterday)
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - 1); // Yesterday
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6); // 7 days total (inclusive)
            
            const formatDate = (date) => date.toISOString().split('T')[0];
            
            console.log('Fetching data from database from', formatDate(startDate), 'to', formatDate(endDate));
            
            const response = await fetch(
                `/api/meter-readings?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const { data, meta } = await response.json();
            
            if (!data || data.length === 0) {
                throw new Error('No data available for the selected date range');
            }
            
            // Process data for the chart
            const processedData = processChartData(data);
            setChartData(processedData);
            setDateRange({
                from: meta?.startDate || formatDate(startDate),
                to: meta?.endDate || formatDate(endDate)
            });
            
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to fetch data. Please try again later.');
            setChartData([]);
        } finally {
            setLoading(false);
        }
    };

    // Process data for the chart
    const processChartData = (readings) => {
        // Group readings by date
        const groupedByDate = readings.reduce((acc, reading) => {
            const date = new Date(reading.reading_date).toISOString().split('T')[0];
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push({
                hour: new Date(reading.reading_date).getHours(),
                value: reading.meter_reading
            });
            return acc;
        }, {});

        // Format for chart
        return Object.entries(groupedByDate).map(([date, hours]) => {
            const dayData = { date };
            hours.forEach(hourData => {
                dayData[`${hourData.hour}:00`] = hourData.value.toFixed(2);
            });
            return dayData;
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="api-demo">
                <h2>Loading data from database...</h2>
                <div className="loading-spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="api-demo">
                <h2>Error</h2>
                <p className="error">{error}</p>
                <button onClick={fetchData} className="retry-button">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="api-demo">
            <h2>Electricity Consumption (From Database)</h2>
            <p>Showing data from {dateRange.from} to {dateRange.to}</p>
            
            <div className="chart-container">
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="date" 
                            angle={-45} 
                            textAnchor="end" 
                            height={70}
                            tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                            label={{ 
                                value: 'kWh', 
                                angle: -90, 
                                position: 'insideLeft',
                                style: { textAnchor: 'middle' }
                            }}
                        />
                        <Tooltip 
                            formatter={(value, name, props) => [`${value} kWh`, name]} 
                            labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Legend />
                        {chartData.length > 0 && 
                            Object.keys(chartData[0])
                                .filter(key => key !== 'date')
                                .map((hour, index) => (
                                    <Line
                                        key={hour}
                                        type="monotone"
                                        dataKey={hour}
                                        name={`${hour}h`}
                                        stroke={`hsl(${(index * 30) % 360}, 70%, 50%)`}
                                        activeDot={{ r: 6 }}
                                        dot={false}
                                    />
                                ))
                        }
                    </LineChart>
                </ResponsiveContainer>
            </div>
            
            <div className="actions">
                <button onClick={fetchData} className="fetch-button">
                    Refresh Data
                </button>
            </div>
            
            <div className="data-info">
                <h3>Data Source</h3>
                <p>This data is fetched from our PostgreSQL database, which is populated by our backend service.</p>
                <p>Total readings: {chartData.length * (chartData[0] ? Object.keys(chartData[0]).length - 1 : 0)}</p>
            </div>
        </div>
    );
};

export default DatabaseDemo;
