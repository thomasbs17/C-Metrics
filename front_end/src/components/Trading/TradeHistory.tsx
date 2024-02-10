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
import { Trade, type tradingDataDef } from '../DataManagement'
import { filterSlice, type FilterState } from '../StateManagement'

interface TableProps {
  selectedPair: boolean
  paper: boolean
  live: boolean
  trades: Trade[]
}

function formatTimeStamp(originalDate: any) {
  let formattedDate = originalDate.substring(0, 19)
  formattedDate = formattedDate.replace('T', ' ')
  return formattedDate
}

function TradeTable({ selectedPair, paper, live, trades }: TableProps) {
  const dispatch = useDispatch()
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )
  const [pair, selectedOrder] = useMemo(
    () => [filterState.pair, filterState.selectedOrder],
    [filterState.pair, filterState.selectedOrder],
  )

  function getFilteredTrades() {
    let filteredTrades = trades.filter((trade: Trade) => {
      const isMatchingPair = selectedPair ? trade.asset_id === pair : true
      const isPaperTrading = paper
        ? trade.trading_env === 'paper_trading'
        : false
      const isLiveTrading = live ? trade.trading_env === 'live' : false
      return isMatchingPair && (isPaperTrading || isLiveTrading)
    })
    filteredTrades = filteredTrades.sort(
      (
        a: { execution_tmstmp: string | number | Date },
        b: { execution_tmstmp: string | number | Date },
      ) =>
        new Date(b.execution_tmstmp).getTime() -
        new Date(a.execution_tmstmp).getTime(),
    )
    return filteredTrades
  }

  function rowBackGroundColor(trade: Trade) {
    if (trade.order_id === selectedOrder[2]) {
      if (trade.trade_side === 'buy') {
        return 'green'
      } else {
        return 'red'
      }
    } else {
      return 'transparent'
    }
  }

  function rowFontColor(trade: Trade) {
    if (trade.order_id === selectedOrder[2]) {
      return 'white'
    } else {
      if (trade.trade_side === 'buy') {
        return 'green'
      } else {
        return 'red'
      }
    }
  }

  const handleClick = (trade: Trade) => {
    if (trade.order_id !== selectedOrder[2]) {
      dispatch(
        filterSlice.actions.setSelectedOrder([
          trade.execution_tmstmp,
          trade.trade_price,
          trade.order_id,
        ]),
      )
      if (pair !== trade['asset_id']) {
        dispatch(filterSlice.actions.setPair(trade.asset_id))
      }
    } else {
      dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
    }
  }

  const filteredTrades = getFilteredTrades()

  return trades.length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <TableContainer sx={{ maxHeight: 170 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell align="left" sx={{ fontSize: 11 }}>
              <u>Execution date</u>
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
              <u>Volume</u>
            </TableCell>
            <TableCell align="left">
              <u>Price</u>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredTrades.map((trade: Trade, index: number) => (
            <TableRow
              key={index}
              sx={{
                '&:last-child td, &:last-child th': { border: 0 },
                cursor: 'pointer',
              }}
              hover
              onClick={() => {
                handleClick(trade)
              }}
            >
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(trade),
                  backgroundColor: rowBackGroundColor(trade),
                  fontSize: 11,
                }}
              >
                {formatTimeStamp(trade.execution_tmstmp)}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(trade),
                  backgroundColor: rowBackGroundColor(trade),
                }}
              >
                {trade.trading_env}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(trade),
                  backgroundColor: rowBackGroundColor(trade),
                }}
              >
                {trade.asset_id}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(trade),
                  backgroundColor: rowBackGroundColor(trade),
                }}
              >
                {trade.trade_side}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(trade),
                  backgroundColor: rowBackGroundColor(trade),
                }}
              >
                {trade.trade_volume.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  color: rowFontColor(trade),
                  backgroundColor: rowBackGroundColor(trade),
                }}
              >
                {trade.trade_price.toLocaleString(undefined, {
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

function Trades(data: { tradingData: tradingDataDef }) {
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
                  checked={selectedPair}
                  onChange={() => {
                    setSelectedPair(!selectedPair)
                  }}
                  size="small"
                />
              }
              label="Selected pair only"
            />
          </Col>
          <Col xs={5} style={{ marginTop: -10 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={paper}
                  onChange={() => {
                    setPaper(!paper)
                  }}
                />
              }
              label="Paper Trading"
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={live}
                  onChange={() => {
                    setLive(!live)
                  }}
                />
              }
              label="Live Trading"
            />
          </Col>
        </Row>
      </div>
      <TradeTable
        selectedPair={selectedPair}
        paper={paper}
        live={live}
        trades={data.tradingData.trades}
      />
    </Container>
  )
}

export default Trades
