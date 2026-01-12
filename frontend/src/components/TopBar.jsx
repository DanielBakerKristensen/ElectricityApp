import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Avatar } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import BoltIcon from '@mui/icons-material/Bolt';
import PropertySelector from './PropertySelector';

const TopBar = ({ onSidebarOpen }) => {
    return (
        <AppBar
            position="fixed"
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                boxShadow: 'none',
            }}
        >
            <Toolbar>
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={onSidebarOpen}
                    sx={{ mr: 2, display: { lg: 'none' } }}
                >
                    <MenuIcon />
                </IconButton>

                <BoltIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1, color: 'primary.main' }} />
                <Typography
                    variant="h6"
                    noWrap
                    component="div"
                    sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', fontWeight: 'bold' }}
                >
                    Electricity App
                </Typography>

                <Box sx={{ mr: 2, display: { xs: 'none', md: 'block' } }}>
                    <PropertySelector />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton color="inherit">
                        <NotificationsIcon />
                    </IconButton>
                    <IconButton sx={{ p: 0 }}>
                        <Avatar alt="User" src="/static/images/avatar/2.jpg" sx={{ bgcolor: 'secondary.main' }}>DB</Avatar>
                    </IconButton>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default TopBar;
