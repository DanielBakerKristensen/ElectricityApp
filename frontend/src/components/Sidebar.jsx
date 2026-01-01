import React from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, useMediaQuery, useTheme } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import ApiIcon from '@mui/icons-material/Api';
import CloudIcon from '@mui/icons-material/Cloud';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import EditNoteIcon from '@mui/icons-material/EditNote';

const items = [
    {
        href: '/',
        icon: <DashboardIcon fontSize="small" />,
        title: 'Dashboard'
    },
    {
        href: '/analysis',
        icon: <BarChartIcon fontSize="small" />,
        title: 'Analysis'
    },
    {
        href: '/weather',
        icon: <CloudIcon fontSize="small" />,
        title: 'Weather'
    },
    {
        href: '/compare',
        icon: <CompareArrowsIcon fontSize="small" />,
        title: 'Compare'
    },
    {
        href: '/annotate',
        icon: <EditNoteIcon fontSize="small" />,
        title: 'Annotate'
    },
    {
        href: '/api-demo',
        icon: <ApiIcon fontSize="small" />,
        title: 'API Demo'
    },
    {
        href: '/settings',
        icon: <SettingsIcon fontSize="small" />,
        title: 'Settings'
    }
];

const Sidebar = ({ open, onClose }) => {
    const theme = useTheme();
    const lgUp = useMediaQuery(theme.breakpoints.up('lg'));
    const location = useLocation();

    const content = (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}
        >
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Logo or extra header content could go here */}
            </Box>
            <Box sx={{ flexGrow: 1 }}>
                <List>
                    {items.map((item) => {
                        const active = location.pathname === item.href;
                        return (
                            <ListItem key={item.title} disablePadding sx={{ display: 'block', mb: 0.5 }}>
                                <ListItemButton
                                    component={RouterLink}
                                    to={item.href}
                                    selected={active}
                                    onClick={!lgUp ? onClose : undefined}
                                    sx={{
                                        minHeight: 48,
                                        justifyContent: open ? 'initial' : 'center',
                                        px: 2.5,
                                        borderRadius: 1,
                                        mx: 1,
                                        '&.Mui-selected': {
                                            backgroundColor: 'rgba(0, 229, 255, 0.12)', // Primary color with opacity
                                            color: 'primary.main',
                                            '&:hover': {
                                                backgroundColor: 'rgba(0, 229, 255, 0.20)',
                                            },
                                            '& .MuiListItemIcon-root': {
                                                color: 'primary.main',
                                            },
                                        },
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        },
                                    }}
                                >
                                    <ListItemIcon
                                        sx={{
                                            minWidth: 0,
                                            mr: 3,
                                            justifyContent: 'center',
                                            color: active ? 'primary.main' : 'text.secondary',
                                        }}
                                    >
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.title}
                                        primaryTypographyProps={{
                                            fontWeight: active ? 600 : 400,
                                            fontSize: '0.95rem'
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </Box>
        </Box>
    );

    if (lgUp) {
        return (
            <Drawer
                anchor="left"
                open
                variant="permanent"
                PaperProps={{
                    sx: {
                        backgroundColor: 'background.paper',
                        width: 280,
                        top: 64, // Height of AppBar
                        height: 'calc(100% - 64px)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                    }
                }}
            >
                {content}
            </Drawer>
        );
    }

    return (
        <Drawer
            anchor="left"
            onClose={onClose}
            open={open}
            PaperProps={{
                sx: {
                    backgroundColor: 'background.paper',
                    width: 280
                }
            }}
            sx={{ zIndex: (theme) => theme.zIndex.appBar + 100 }}
            variant="temporary"
        >
            {content}
        </Drawer>
    );
};

export default Sidebar;
