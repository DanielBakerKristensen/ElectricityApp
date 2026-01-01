// Chart configuration utility for ApexCharts
// Provides consistent styling and configuration across all charts

// Base theme colors matching Material-UI
const lightColors = {
  primary: '#8884d8',
  success: '#00E396',
  danger: '#FF6B6B',
  text: '#263238',
  grid: '#e0e0e0'
};

const darkColors = {
  primary: '#00E5FF', // Cyan
  success: '#00E676', // Bright Green
  danger: '#FF4081',  // Pink/Red
  text: '#FFFFFF',
  grid: '#424242'
};

// Helper to get colors based on mode
const getColors = (mode) => mode === 'dark' ? darkColors : lightColors;

// Common base chart options
export const getBaseChartOptions = (mode = 'light') => {
  const colors = getColors(mode);

  return {
    chart: {
      background: 'transparent',
      toolbar: {
        show: true,
        tools: {
          download: true,
          zoom: true,
          pan: true,
          reset: true
        }
      },
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    grid: {
      borderColor: colors.grid,
      strokeDashArray: 3
    },
    theme: {
      mode: mode
    },
    // Global text styles
    dataLabels: {
      style: {
        colors: [colors.text]
      }
    }
  };
};

// Candlestick-specific chart options
export const getCandlestickOptions = (categories, zeroDataDates = [], mode = 'light') => {
  const colors = getColors(mode);
  const baseOptions = getBaseChartOptions(mode);

  // Create array of colors for x-axis labels (red for zero-data days)
  const labelColors = categories.map(date =>
    zeroDataDates.includes(date) ? colors.danger : colors.text
  );

  return {
    ...baseOptions,
    chart: {
      ...baseOptions.chart,
      type: 'candlestick',
      height: 400
    },
    title: {
      text: 'Daily Energy Consumption Range',
      align: 'left',
      style: {
        fontSize: '16px',
        fontWeight: 600,
        color: colors.text
      }
    },
    xaxis: {
      type: 'category',
      categories: categories,
      labels: {
        rotate: -45,
        rotateAlways: true,
        style: {
          fontSize: '12px',
          colors: labelColors
        }
      },
      axisBorder: {
        color: colors.grid
      },
      axisTicks: {
        color: colors.grid
      }
    },
    yaxis: {
      title: {
        text: 'Consumption (kWh)',
        style: {
          fontSize: '12px',
          color: colors.text
        }
      },
      labels: {
        style: {
          fontSize: '12px',
          colors: colors.text
        },
        formatter: (value) => {
          return (value !== null && value !== undefined) ? Number(value).toFixed(1) : '';
        }
      }
    },
    tooltip: {
      theme: mode,
      custom: function ({ seriesIndex, dataPointIndex, w }) {
        const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        const bgColor = mode === 'dark' ? '#1e1e1e' : 'white';
        const borderColor = mode === 'dark' ? '#444' : '#e0e0e0';
        const textColor = mode === 'dark' ? '#fff' : '#333';

        return `
          <div style="padding: 10px; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 4px; color: ${textColor}">
            <div style="margin-bottom: 5px; font-weight: 600;">Date: ${data.x}</div>
            <div style="color: ${colors.success};">High: ${Number(data.y[1]).toFixed(3)} kWh</div>
            <div style="color: ${colors.danger};">Low: ${Number(data.y[2]).toFixed(3)} kWh</div>
            <div style="color: ${colors.primary};">Average: ${Number(data.y[0]).toFixed(3)} kWh</div>
          </div>
        `;
      }
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: colors.success,
          downward: colors.danger
        },
        wick: {
          useFillColor: true
        }
      }
    }
  };
};

// Horizontal bar chart options
export const getHorizontalBarOptions = (categories, dataLength, mode = 'light') => {
  const colors = getColors(mode);
  const baseOptions = getBaseChartOptions(mode);
  const dynamicHeight = Math.max(dataLength * 25 + 200, 600);

  return {
    ...baseOptions,
    chart: {
      ...baseOptions.chart,
      type: 'bar',
      height: dynamicHeight,
      toolbar: {
        show: true,
        tools: {
          download: true,
          zoom: false,
          pan: false,
          reset: false
        }
      }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        borderRadiusApplication: 'end',
        barHeight: '70%',
        colors: {
          backgroundBarColors: [],
          backgroundBarOpacity: 1
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    title: {
      text: 'Hourly Electricity Consumption',
      align: 'left',
      style: {
        fontSize: '16px',
        fontWeight: 600,
        color: colors.text
      }
    },
    xaxis: {
      categories: categories,
      title: {
        text: 'Consumption (kWh)',
        style: {
          fontSize: '12px',
          color: colors.text
        }
      },
      labels: {
        style: {
          fontSize: '12px',
          colors: colors.text
        }
      },
      axisBorder: {
        color: colors.grid
      },
      axisTicks: {
        color: colors.grid
      }
    },
    yaxis: {
      labels: {
        style: {
          fontSize: '10px',
          colors: colors.text
        }
      }
    },
    tooltip: {
      theme: mode,
      y: {
        formatter: function (value) {
          return (value !== null && value !== undefined) ? Number(value).toFixed(3) + ' kWh' : '';
        }
      }
    },
    colors: [colors.primary]
  };
};
