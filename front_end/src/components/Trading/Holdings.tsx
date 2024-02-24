import { CircularProgress } from '@mui/material'
import { ColDef, RowClickedEvent } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  LatestHoldings,
  getHoldingVolumesFromTrades,
  tradingDataDef,
} from '../DataManagement'
import { FilterState, filterSlice } from '../StateManagement'
import '../../css/tables.css'

type FormattedHoldings = {
  pair: string
  volume: number
  usdValue: number | string
}

function Holdings(data: { tradingData: tradingDataDef }) {
  const [currentHoldings, setCurrentHoldings] = useState<LatestHoldings>({})
  const [formattedHoldings, setFormattedHoldings] = useState<
    FormattedHoldings[]
  >([])
  const [colDefs, setColDefs] = useState<ColDef<FormattedHoldings>[]>([])
  const selectedPair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )
  const dispatch = useDispatch()

  useEffect(() => {
    const holdings = getHoldingVolumesFromTrades(data.tradingData.trades)
    setCurrentHoldings(holdings.current)
    let formattedHoldings: FormattedHoldings[] = []
    Object.keys(holdings.current).forEach((pair: string) =>
      formattedHoldings.push({
        pair: pair,
        volume: holdings.current[pair],
        usdValue: getUSDValue(pair, holdings.current[pair]),
      }),
    )
    formattedHoldings = formattedHoldings.sort((a, b) => (typeof a.usdValue === 'string' || typeof b.usdValue === 'string') ? 0 : b.usdValue - a.usdValue);
    setFormattedHoldings(formattedHoldings)
    setColDefs([
      { field: 'pair', flex: 1, filter: true },
      { field: 'volume', flex: 1 },
      { field: 'usdValue', flex: 1 },
    ])
  }, [data.tradingData.ohlcvData, data.tradingData.trades])

  const handleClick = (holding: RowClickedEvent<FormattedHoldings, any>) => {
    if (holding.rowIndex || holding.rowIndex === 0) {
      const selectedHolding = formattedHoldings[holding.rowIndex]
      dispatch(filterSlice.actions.setPair(selectedHolding.pair))
    }
  }

  function getUSDValue(pair: string, volume: number) {
    const ohlcv = data.tradingData.ohlcvData[pair]
    if (ohlcv === undefined || ohlcv === null) {
      return 'N/A'
    } else {
      const lastPrice = ohlcv[ohlcv.length - 1][3]
      return volume * lastPrice
    }
  }

  return formattedHoldings.length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <div
      className={'ag-theme-quartz-dark'}
      style={{ width: '100%', height: '180px' }}
    >
      <AgGridReact
        rowData={formattedHoldings}
        columnDefs={colDefs}
        onRowClicked={(r) => handleClick(r)}
        rowSelection={'single'}
      />
    </div>
  )
}

export default Holdings
