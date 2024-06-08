import { Box, CssBaseline } from '@mui/material'
import { GetTradingData, tradingDataDef } from '../components/DataManagement'
import HoldingsTable from '../components/Trading/Holdings'
import MiniDrawer from '../components/Trading/SideBar'

function Portfolio() {
  const tradingData: tradingDataDef = GetTradingData()
  return (
    <Box sx={{ display: 'flex', paddingLeft: '5%', paddingRight: '2%', flexDirection: 'column', paddingTop: '2%' }}>
      <CssBaseline />
      <MiniDrawer />
      <h2>Portfolio</h2>
      <canvas style={{ height: '400px' }}>Chart</canvas>
      <HoldingsTable tradingData={tradingData} />
    </Box>
  )
}

export default Portfolio
