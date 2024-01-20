import { Box, Tab, Tabs } from '@mui/material'
import React from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import { useDispatch } from 'react-redux'
import {
  GetTradingData,
  type tradingDataDef,
} from '../components/DataManagement'
import { filterSlice } from '../components/StateManagement'
import { TradingChart } from '../components/Trading/Chart'
import CreateOrderWidget from '../components/Trading/CreateOrder'
import { TopBar } from '../components/Trading/Filters'
import Holdings from '../components/Trading/Holdings'
import Orders from '../components/Trading/Orders'
// import AddRemoveLayout from '../components/ResizablePanel'
import { Responsive, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import News from '../components/Trading/News'
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
    <div
      className="border border-primary rounded-3 p-3"
      style={{ height: '250px' }}
    >
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

function BottomContainer(data: { tradingData: tradingDataDef }) {
  const layout = [
    { i: 'a', x: 2, y: 0, w: 1000, h: 10 },
    { i: 'b', x: 10, y: 0, w: 10000, h: 10, maxW: 4 },
  ]
  return (
    <ResponsiveGridLayout
      className="layout"
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      // layouts={layout}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
    >
      <div
        style={{
          borderRadius: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        }}
        key="a"
      >
        <BottomLeftContainer tradingData={data.tradingData} />
      </div>
      <div
        style={{
          borderRadius: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        }}
        key="b"
      >
        <BottomRightContainer tradingData={data.tradingData} />
      </div>
    </ResponsiveGridLayout>
  )
}

function BottomRightContainer(data: { tradingData: tradingDataDef }) {
  const [value, setValue] = React.useState('news')

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue)
  }
  return (
    <div
      className="border border-primary rounded-3 p-3"
      style={{ height: '250px', overflowY: 'hidden' }}
    >
      <Box sx={{ width: '100%' }}>
        <Tabs
          value={value}
          onChange={handleChange}
          aria-label="bottom-right-tab"
          variant="fullWidth"
        >
          <Tab value="news" label="News" sx={{ height: '30px' }} />
          <Tab value="screening" label="Screening" />
        </Tabs>
        {value === 'news' && <News tradingData={data.tradingData} />}
        {value === 'screening' && (
          <Screening screeningData={data.tradingData.screeningData} />
        )}
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
        <Row>
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
