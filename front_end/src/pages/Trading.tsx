import { Box, Tab, Tabs } from '@mui/material'
import React from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import { Responsive, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { useDispatch } from 'react-redux'
import 'react-resizable/css/styles.css'
import {
  GetTradingData,
  type tradingDataDef,
} from '../components/DataManagement'
import { filterSlice } from '../components/StateManagement'
import { TradingChart } from '../components/Trading/Chart'
import CreateOrderWidget from '../components/Trading/CreateOrder'
import EconomicCalendar from '../components/Trading/EconomicCalendar'
import { TopBar } from '../components/Trading/Header'
import Holdings from '../components/Trading/Holdings'
import News from '../components/Trading/News'
import Orders from '../components/Trading/Orders'
import Screening from '../components/Trading/Screening'
import Trades from '../components/Trading/TradeHistory'

const ResponsiveGridLayout = WidthProvider(Responsive)

function BottomLeftContainer(data: { tradingData: tradingDataDef }) {
  const dispatch = useDispatch()
  const [value, setValue] = React.useState('orders')

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue)
    dispatch(filterSlice.actions.setOrdersNeedReload(true))
  }
  return (
    <div style={{ height: '250px' }}>
      <Box sx={{ width: '100%' }}>
        <Tabs
          value={value}
          onChange={handleChange}
          aria-label="bottom-left-tab"
          variant="fullWidth"
        >
          <Tab value="orders" label="Orders" />
          <Tab value="holdings" label="Holdings" />
          <Tab value="trade-history" label="Trade History" />
          <Tab value="create-order" label="Create Order" />
        </Tabs>
        {value === 'orders' && <Orders tradingData={data.tradingData} />}
        {value === 'holdings' && <Holdings tradingData={data.tradingData} />}
        {value === 'trade-history' && <Trades tradingData={data.tradingData} />}
        {value === 'create-order' && <CreateOrderWidget />}
      </Box>
    </div>
  )
}

function BottomRightContainer(data: { tradingData: tradingDataDef }) {
  const [value, setValue] = React.useState('news')

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue)
  }
  return (
    <div style={{ height: '250px', overflowY: 'hidden' }}>
      <Box sx={{ width: '100%' }}>
        <Tabs
          value={value}
          onChange={handleChange}
          aria-label="bottom-right-tab"
          variant="fullWidth"
        >
          <Tab value="news" label="News" sx={{ height: '30px' }} />
          <Tab value="screening" label="Screening" />
          <Tab value="economic-calendar" label="Economic Calendar" />
        </Tabs>
        {value === 'news' && <News tradingData={data.tradingData} />}
        {value === 'screening' && <Screening tradingData={data.tradingData} />}
        {value === 'economic-calendar' && <EconomicCalendar />}
      </Box>
    </div>
  )
}

function Trading() {
  const tradingData: tradingDataDef = GetTradingData()

  return (
    <div style={{ overflow: 'hidden' }}>
      <TopBar tradingData={tradingData} />
      <Container fluid>
        <TradingChart tradingData={tradingData} />
        <Row
          className="border border-primary rounded-3 p-3"
          style={{ height: '250px' }}
        >
          <Col style={{ maxWidth: '50%' }}>
            <BottomLeftContainer tradingData={tradingData} />
          </Col>
          <Col style={{ maxWidth: '50%' }}>
            <BottomRightContainer tradingData={tradingData} />
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default Trading
