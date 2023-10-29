import {
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import { Order, tradingDataDef } from '../DataManagement'
import { FilterState, filterSlice } from '../StateManagement'

interface TableProps {
  openOnly: boolean
  selectedPair: boolean
  paper: boolean
  live: boolean
  orders: Order[]
}

function formatTimeStamp(originalDate: any) {
  let formattedDate = originalDate.substring(0, 19)
  formattedDate = formattedDate.replace('T', ' ')
  return formattedDate
}

function OrderTable({
  openOnly,
  selectedPair,
  paper,
  live,
  orders,
}: TableProps) {
  const dispatch = useDispatch()
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )
  const [pair, selectedOrder] = useMemo(
    () => [filterState.pair, filterState.selectedOrder],
    [filterState.pair, filterState.selectedOrder],
  )

  function getFilteredOrders() {
    let filteredOrders = orders.filter((order: Order) => {
      const isOpen = openOnly ? order.order_status === 'open' : true
      const isMatchingPair = selectedPair ? order.asset_id === pair : true
      const isPaperTrading = paper
        ? order.trading_env === 'paper_trading'
        : false
      const isLiveTrading = live ? order.trading_env === 'live' : false
      return isOpen && isMatchingPair && (isPaperTrading || isLiveTrading)
    })
    filteredOrders = filteredOrders.sort(
      (
        a: { order_creation_tmstmp: string | number | Date },
        b: { order_creation_tmstmp: string | number | Date },
      ) =>
        new Date(b.order_creation_tmstmp).getTime() -
        new Date(a.order_creation_tmstmp).getTime(),
    )
    return filteredOrders
  }

  function rowBackGroundColor(order: Order) {
    if (order.order_id === selectedOrder[2]) {
      if (order.order_side === 'buy') {
        return 'green'
      } else {
        return 'red'
      }
    } else {
      return 'transparent'
    }
  }

  function rowFontColor(order: Order) {
    if (order.order_id === selectedOrder[2]) {
      return 'white'
    } else {
      if (order.order_side === 'buy') {
        return 'green'
      } else {
        return 'red'
      }
    }
  }

  const handleClick = (order: Order) => {
    if (order.order_id !== selectedOrder[2]) {
      dispatch(filterSlice.actions.setPairScoreDetails({}))
      dispatch(filterSlice.actions.setPair(order.asset_id))
      dispatch(
        filterSlice.actions.setSelectedOrder([
          order.order_creation_tmstmp,
          order.order_price,
          order.order_id,
        ]),
      )
    } else {
      dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
    }
  }

  const filteredOrders = getFilteredOrders()

  return orders.length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <TableContainer sx={{ maxHeight: 170 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell align="left" sx={{ fontSize: 11 }}>
              <u>Creation Date</u>
            </TableCell>
            <TableCell align="left">
              <u>Environment</u>
            </TableCell>
            <TableCell align="left">
              <u>Asset</u>
            </TableCell>
            <TableCell align="left">
              <u>Side</u>
            </TableCell>
            <TableCell align="left">
              <u>Type</u>
            </TableCell>
            <TableCell align="left">
              <u>Status</u>
            </TableCell>
            <TableCell align="left">
              <u>Fill %</u>
            </TableCell>
            <TableCell align="left">
              <u>Volume</u>
            </TableCell>
            <TableCell align="left">
              <u>Price</u>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredOrders.map((order: Order, index: number) => (
            <TableRow
              key={index}
              sx={{
                '&:last-child td, &:last-child th': { border: 0 },
                cursor: 'pointer',
              }}
              hover
              onClick={() => handleClick(order)}
            >
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(order),
                  backgroundColor: rowBackGroundColor(order),
                  fontSize: 11,
                }}
              >
                {formatTimeStamp(order.order_creation_tmstmp)}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(order),
                  backgroundColor: rowBackGroundColor(order),
                }}
              >
                {order.trading_env}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(order),
                  backgroundColor: rowBackGroundColor(order),
                }}
              >
                {order.asset_id}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(order),
                  backgroundColor: rowBackGroundColor(order),
                }}
              >
                {order.order_side}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(order),
                  backgroundColor: rowBackGroundColor(order),
                }}
              >
                {order.order_type}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(order),
                  backgroundColor: rowBackGroundColor(order),
                }}
              >
                {order.order_status}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(order),
                  backgroundColor: rowBackGroundColor(order),
                }}
              >
                {order.fill_pct * 100}%
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(order),
                  backgroundColor: rowBackGroundColor(order),
                }}
              >
                {order.order_volume.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(order),
                  backgroundColor: rowBackGroundColor(order),
                }}
              >
                {order.order_price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function Orders(data: { tradingData: tradingDataDef }) {
  const [openOnly, setOpenOnly] = useState(true)
  const [selectedPair, setSelectedPair] = useState(true)
  const [paper, setPaper] = useState(true)
  const [live, setLive] = useState(false)
  return (
    <Container>
      <div style={{ zIndex: 1000, position: 'relative' }}>
        <Row>
          <Col xs={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={openOnly}
                  onChange={() => setOpenOnly(!openOnly)}
                />
              }
              label="Open orders only"
            />
          </Col>
          <Col xs={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={selectedPair}
                  onChange={() => setSelectedPair(!selectedPair)}
                />
              }
              label="Selected pair only"
            />
          </Col>
          <Col xs={5}>
            <FormControlLabel
              control={
                <Checkbox checked={paper} onChange={() => setPaper(!paper)} />
              }
              label="Paper Trading"
            />
            <FormControlLabel
              control={
                <Checkbox checked={live} onChange={() => setLive(!live)} />
              }
              label="Live Trading"
            />
          </Col>
        </Row>
      </div>
      <OrderTable
        openOnly={openOnly}
        selectedPair={selectedPair}
        paper={paper}
        live={live}
        orders={data.tradingData.orders}
      />
    </Container>
  )
}

export default Orders
