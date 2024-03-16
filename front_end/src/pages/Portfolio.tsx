import { Box, CssBaseline } from '@mui/material'
import MiniDrawer from '../components/Trading/SideBar'

function Portfolio() {
  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <MiniDrawer />
      <p>Portfolio</p>
    </Box>
  )
}

export default Portfolio
