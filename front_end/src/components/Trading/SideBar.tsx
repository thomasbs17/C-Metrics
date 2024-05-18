import { Avatar, IconButton, Tooltip } from '@mui/material'
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar'
import Divider from '@mui/material/Divider'
import MuiDrawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import { deepPurple } from '@mui/material/colors'
import { CSSObject, Theme, styled } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { pages } from '../Navbar'

const drawerWidth = 240

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
})

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
})

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}))

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': closedMixin(theme),
  }),
}))

export default function MiniDrawer() {
  const navigate = useNavigate()
  const currentUrl = window.location.href.slice(7)
  const endpoint = currentUrl.slice(currentUrl.indexOf('/'))

  return (
    <Drawer variant="permanent">
      <DrawerHeader>
        <Tooltip title="USER">
          <IconButton
            sx={{ p: 0 }}
            onClick={() => {
              navigate('/sign-in')
            }}
          >
            <Avatar sx={{ bgcolor: deepPurple[500] }}>TB</Avatar>
          </IconButton>
        </Tooltip>
      </DrawerHeader>
      <Divider />
      <List>
        {pages.map((page: any) => (
          <Tooltip title={page['name']} placement="right" key={page.name}>
            <ListItem
              key={page['name']}
              disablePadding
              sx={{
                display: 'block',
                backgroundColor:
                  endpoint === page['href'] ? 'rgba(0, 255, 0, 0.1)' : null,
              }}
            >
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent: 'center',
                  px: 2.5,
                }}
                onClick={() => {
                  navigate(page['href'])
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {page['icon']}
                </ListItemIcon>
                <ListItemText primary={page['name']} sx={{ opacity: 0 }} />
              </ListItemButton>
            </ListItem>
          </Tooltip>
        ))}
      </List>
    </Drawer>
  )
}
