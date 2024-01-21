import {
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Trade, tradingDataDef } from '../DataManagement'
import { FilterState, filterSlice } from '../StateManagement'

type Holdings = { [asset: string]: [string, number][] }
type LatestHoldings = { [asset: string]: number }

function getHoldingVolumesFromTrades(trades: Trade[]) {
  let holdings: Holdings = {}
  let currentHoldings: LatestHoldings = {}
  const sortedTrades = trades.sort(
    (
      a: { execution_tmstmp: string | number | Date },
      b: { execution_tmstmp: string | number | Date },
    ) =>
      new Date(a.execution_tmstmp).getTime() -
      new Date(b.execution_tmstmp).getTime(),
  )
  sortedTrades.forEach((trade: Trade) => {
    const pair: string = trade.asset_id
    const tradeVolume =
      trade.trade_side === 'buy' ? trade.trade_volume : -trade.trade_volume
    if (!Object.keys(holdings).includes(pair)) {
      holdings[pair] = [[trade.execution_tmstmp, tradeVolume]]
      currentHoldings[pair] = tradeVolume
    } else {
      let cumulatedPairVolume = holdings[pair][holdings[pair].length - 1][1]
      cumulatedPairVolume = cumulatedPairVolume + tradeVolume
      holdings[pair].push([trade.execution_tmstmp, cumulatedPairVolume])
      currentHoldings[pair] += tradeVolume
    }
  })
  for (const pair in currentHoldings) {
    if (currentHoldings[pair] === 0) {
      delete currentHoldings[pair]
    }
  }
  const entries = Object.entries(currentHoldings)
  entries.sort((a, b) => b[1] - a[1])
  const sortedHoldings = Object.fromEntries(entries)
  return { history: holdings, current: sortedHoldings }
}

function Holdings(data: { tradingData: tradingDataDef }) {
  const [currentHoldings, setCurrentHoldings] = useState<LatestHoldings>({})
  const selectedPair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )
  const dispatch = useDispatch()

  useEffect(() => {
    const holdings = getHoldingVolumesFromTrades(data.tradingData.trades)
    setCurrentHoldings(holdings.current)
  }, [data.tradingData.trades])

  const handleClick = (pair: string) => {
    if (pair !== selectedPair) {
      dispatch(filterSlice.actions.setLoadingComponents(['ohlcv', true]))
      dispatch(filterSlice.actions.setPair(pair))
    }
  }

  function rowBackGroundColor(pair: string) {
    if (pair === selectedPair) {
      return 'green'
    } else {
      return 'transparent'
    }
  }

  return Object.keys(currentHoldings).length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <TableContainer sx={{ maxHeight: 170 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell align="left" sx={{ fontSize: 11 }}>
              <u>Pair</u>
            </TableCell>
            <TableCell align="left">
              <u>Amount</u>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.keys(currentHoldings).map((pair: string, index: number) => (
            <TableRow
              key={index}
              onClick={() => {
                handleClick(pair)
              }}
              sx={{
                '&:last-child td, &:last-child th': { border: 0 },
                cursor: 'pointer',
              }}
              hover
            >
              <TableCell
                align="left"
                sx={{
                  backgroundColor: rowBackGroundColor(pair),
                }}
              >
                {pair}
              </TableCell>
              <TableCell
                align="left"
                sx={{
                  backgroundColor: rowBackGroundColor(pair),
                }}
              >
                {currentHoldings[pair]}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default Holdings
