import React, { useState } from 'react';
import { Box, Container } from '@mui/material';
import { Outlet } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Sidebar from '../components/Sidebar';

const DashboardLayout = ({ children }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
            <TopBar onSidebarOpen={() => setSidebarOpen(true)} />
            <Sidebar
                onClose={() => setSidebarOpen(false)}
                open={isSidebarOpen}
            />
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    pt: { xs: 10, lg: 12 }, // Add padding top to account for AppBar
                    pl: { lg: '280px' }, // Add padding left to account for Sidebar on large screens
                    width: '100%',
                    backgroundColor: 'background.default',
                    minHeight: '100vh',
                }}
            >
                <Container maxWidth="lg">
                    {children || <Outlet />}
                </Container>
            </Box>
        </Box>
    );
};

export default DashboardLayout;
