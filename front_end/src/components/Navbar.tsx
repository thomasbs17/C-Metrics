import AdbIcon from '@mui/icons-material/Adb'
import CandlestickChartOutlinedIcon from '@mui/icons-material/CandlestickChartOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import WalletOutlinedIcon from '@mui/icons-material/WalletOutlined'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import * as React from 'react'

export const pages: any = [
  { icon: <HomeOutlinedIcon />, name: 'Home', href: '/' },
  { icon: <CandlestickChartOutlinedIcon />, name: 'Trading', href: '/trading' },
  { icon: <WalletOutlinedIcon />, name: 'Portfolio', href: '/portfolio' },
  { icon: <ManageSearchOutlinedIcon />, name: 'Screening', href: '/screening' },
  { icon: <SmartToyOutlinedIcon />, name: 'Trading Bots', href: '/bots' },
]
const settings = ['Profile', 'Account', 'Dashboard', 'Logout']

export function UserMenu() {
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(
    null,
  )
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget)
  }
  const handleCloseUserMenu = () => {
    setAnchorElUser(null)
  }

  return (
    <Box sx={{ flexGrow: 0 }}>
      <Tooltip title="Open settings">
        <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
          <Avatar alt="Remy Sharp" />
        </IconButton>
      </Tooltip>
      <Menu
        sx={{ mt: '45px' }}
        id="menu-appbar"
        anchorEl={anchorElUser}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
      >
        {settings.map((setting) => (
          <MenuItem key={setting} onClick={handleCloseUserMenu}>
            <Typography textAlign="center">{setting}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}

function NavBar() {
  const [, setAnchorElNav] = React.useState<null | HTMLElement>(null)

  const handleCloseNavMenu = () => {
    setAnchorElNav(null)
  }

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <AdbIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            Crypto Station
          </Typography>
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            {pages.map((page: any) => (
              <Button
                key={page['name']}
                onClick={handleCloseNavMenu}
                href={page['href']}
                sx={{ my: 2, color: 'white', display: 'block' }}
              >
                {page['name']}
              </Button>
            ))}
          </Box>
          <UserMenu />
        </Toolbar>
      </Container>
    </AppBar>
  )
}
export default NavBar
