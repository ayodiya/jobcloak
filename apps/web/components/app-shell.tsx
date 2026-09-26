'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import GridViewIcon from '@mui/icons-material/GridView';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import InsightsIcon from '@mui/icons-material/Insights';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import StorageIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

const DRAWER_WIDTH = 224;

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: <GridViewIcon /> },
  { href: '/jobs', label: 'Jobs', icon: <BusinessCenterIcon /> },
  { href: '/matches', label: 'Matches', icon: <InsightsIcon /> },
  { href: '/applications', label: 'Applications', icon: <AssignmentIcon /> },
  { href: '/candidate', label: 'Candidate', icon: <PersonIcon /> },
  { href: '/automation', label: 'Automation', icon: <RocketLaunchIcon /> },
  { href: '/sources', label: 'Sources', icon: <StorageIcon /> },
  { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  { href: '/audit', label: 'Audit', icon: <ReceiptLongIcon /> },
];

function NavContent({ currentPath }: { currentPath: string }) {
  return (
    <List component="nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
        return (
          <ListItemButton
            key={item.href}
            component={Link}
            href={item.href}
            selected={active}
            aria-current={active ? 'page' : undefined}
            sx={{ borderRadius: 1, mx: 1, mb: 0.25 }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: active ? 'primary.main' : 'inherit' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        );
      })}
    </List>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const permanent = useMediaQuery(theme.breakpoints.up('md'));
  const pathname = usePathname();

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            aria-label="Toggle navigation"
            onClick={() => setMobileOpen((open) => !open)}
            sx={{ mr: 2, display: permanent ? 'none' : 'inline-flex' }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="h1" noWrap>
            Jobcloak
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', ml: 2, display: { xs: 'none', sm: 'block' } }}
          >
            Local AI job assistant
          </Typography>
        </Toolbar>
      </AppBar>

      <nav aria-label="Sidebar">
        <Drawer
          variant={permanent ? 'permanent' : 'temporary'}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            width: DRAWER_WIDTH,
            [`& .MuiDrawer-paper`]: {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              bgcolor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <Toolbar />
          <NavContent currentPath={pathname} />
        </Drawer>
      </nav>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          py: 3,
          px: { xs: 2, md: 4 },
          mt: '64px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
