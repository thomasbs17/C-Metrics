import { CircularProgress } from '@mui/material'
import { ColDef, RowClickedEvent } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import '../../css/tables.css'
import {
  LatestHoldings,
  getHoldingVolumesFromTrades,
  tradingDataDef
} from '../DataManagement'
import { filterSlice } from '../StateManagement'

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
  const dispatch = useDispatch()


  async function prepareTable() {
    let formattedHoldings: FormattedHoldings[] = []
    Object.keys(currentHoldings).forEach((pair: string) =>
      formattedHoldings.push({
        pair: pair,
        volume: currentHoldings[pair],
        usdValue: getUSDValue(pair),
      }),
    )
    formattedHoldings = formattedHoldings.sort((a, b) => (typeof a.usdValue === 'string' || typeof b.usdValue === 'string') ? 0 : b.usdValue - a.usdValue);
    setFormattedHoldings(formattedHoldings)
    setColDefs([
      { field: 'pair', flex: 1, filter: true },
      { field: 'volume', flex: 1, cellRenderer: 'agAnimateShowChangeCellRenderer' },
      { field: 'usdValue', flex: 1, cellRenderer: 'agAnimateShowChangeCellRenderer' },
    ])
  }

  useEffect(() => {
    const holdings = getHoldingVolumesFromTrades(data.tradingData.trades)
    setCurrentHoldings(holdings.current)
  }, [JSON.stringify(data.tradingData.latestPrices), JSON.stringify(data.tradingData.trades)])

  useEffect(() => {
    prepareTable()
  }, [currentHoldings])

  const handleClick = (holding: RowClickedEvent<FormattedHoldings, any>) => {
    if (holding.rowIndex || holding.rowIndex === 0) {
      const selectedHolding = formattedHoldings[holding.rowIndex]
      dispatch(filterSlice.actions.setPair(selectedHolding.pair))
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
      // onGridReady={onGridReady}
      />
    </div>
  )
}

export default Holdings
