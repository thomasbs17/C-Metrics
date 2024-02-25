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
import {
  LatestHoldings,
  getHoldingVolumesFromTrades,
  tradingDataDef
} from '../DataManagement'
import { FilterState, filterSlice } from '../StateManagement'

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
    dispatch(filterSlice.actions.setPair(pair))
  }

  function rowBackGroundColor(pair: string) {
    if (pair === selectedPair) {
      return 'green'
    } else {
      return 'transparent'
    }
  }

  function getUSDValue(pair: string) {
    const lastPrice = data.tradingData.latestPrices[pair]
    if (lastPrice === undefined || lastPrice === null) {
      return 'N/A'
    } else {
      return currentHoldings[pair] * lastPrice
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
            <TableCell align="left">
              <u>USD value</u>
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
              <TableCell
                align="left"
                sx={{
                  backgroundColor: rowBackGroundColor(pair),
                }}
              >
                {getUSDValue(pair)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default Holdings
