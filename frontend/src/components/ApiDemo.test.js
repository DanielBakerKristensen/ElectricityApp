import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApiDemo from './ApiDemo';

// Mock fetch
global.fetch = jest.fn();

describe('ApiDemo - Chart Updates with Date Range', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    fetch.mockClear();
  });

  const mockSuccessResponse = {
    result: [{
      success: true,
      errorCode: 10000,
      MyEnergyData_MarketDocument: {
        TimeSeries: [{
          Period: [
            {
              timeInterval: { start: '2025-01-01T00:00:00Z' },
              Point: [
                { position: '1', 'out_Quantity.quantity': '1.5', 'out_Quantity.quality': 'A01' },
                { position: '2', 'out_Quantity.quantity': '2.0', 'out_Quantity.quality': 'A01' },
                { position: '3', 'out_Quantity.quantity': '1.8', 'out_Quantity.quality': 'A01' }
              ]
            },
            {
              timeInterval: { start: '2025-01-02T00:00:00Z' },
              Point: [
                { position: '1', 'out_Quantity.quantity': '2.5', 'out_Quantity.quality': 'A01' },
                { position: '2', 'out_Quantity.quantity': '3.0', 'out_Quantity.quality': 'A01' }
              ]
            }
          ]
        }]
      }
    }]
  };

  const mockEmptyResponse = {
    result: [{
      success: true,
      errorCode: 10000,
      MyEnergyData_MarketDocument: {
        TimeSeries: [{
          Period: []
        }]
      }
    }]
  };

  test('both charts update with new data after date selection and refresh', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse
    });

    render(<ApiDemo />);

    // Change dates
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);
    
    fireEvent.change(startDateInput, { target: { value: '2025-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2025-01-02' } });

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh data/i });
    fireEvent.click(refreshButton);

    // Wait for data to load
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('dateFrom=2025-01-01&dateTo=2025-01-02')
      );
    });

    // Verify both charts are rendered with data
    await waitFor(() => {
      expect(screen.getByText(/daily energy consumption range/i)).toBeInTheDocument();
      expect(screen.getByText(/hourly electricity consumption/i)).toBeInTheDocument();
    });

    // Verify debug info shows data points
    await waitFor(() => {
      expect(screen.getByText(/hourly data points: 5/i)).toBeInTheDocument();
      expect(screen.getByText(/daily range data points: 2/i)).toBeInTheDocument();
    });
  });

  test('charts display only data points within selected date range', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse
    });

    render(<ApiDemo />);

    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);
    
    fireEvent.change(startDateInput, { target: { value: '2025-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2025-01-02' } });

    const refreshButton = screen.getByRole('button', { name: /refresh data/i });
    fireEvent.click(refreshButton);

    // Verify the API was called with the correct date range
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/test-data?dateFrom=2025-01-01&dateTo=2025-01-02');
    });

    // Verify data is displayed
    await waitFor(() => {
      expect(screen.getByText(/hourly data points: 5/i)).toBeInTheDocument();
    });
  });

  test('loading indicators appear on both charts during data fetch', async () => {
    // Mock a delayed response
    fetch.mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: async () => mockSuccessResponse
        }), 100)
      )
    );

    render(<ApiDemo />);

    const refreshButton = screen.getByRole('button', { name: /refresh data/i });
    fireEvent.click(refreshButton);

    // Check loading state on button
    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();

    // Check loading messages for charts
    expect(screen.getByText(/loading data\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/loading range data\.\.\./i)).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh data/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('displays "No data available" message when API returns empty results', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEmptyResponse
    });

    render(<ApiDemo />);

    const refreshButton = screen.getByRole('button', { name: /refresh data/i });
    fireEvent.click(refreshButton);

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Verify "No data available" messages are shown
    await waitFor(() => {
      const noDataMessages = screen.getAllByText(/no.*data available/i);
      expect(noDataMessages.length).toBeGreaterThan(0);
    });
  });

  test('displays error message when API call fails', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<ApiDemo />);

    const refreshButton = screen.getByRole('button', { name: /refresh data/i });
    fireEvent.click(refreshButton);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/failed to fetch data/i)).toBeInTheDocument();
    });
  });

  test('date range display updates with selected dates', () => {
    render(<ApiDemo />);

    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);
    
    fireEvent.change(startDateInput, { target: { value: '2025-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2025-01-07' } });

    // Verify the date range display is updated
    expect(screen.getByText(/showing data from.*jan.*1.*2025.*to.*jan.*7.*2025/i)).toBeInTheDocument();
  });
});
