import { CircularProgress } from '@mui/material'
import { ColDef } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import '../../css/tables.css'
import { getHoldingVolumesFromTrades, tradingDataDef } from '../DataManagement'
import { FilterState, filterSlice } from '../StateManagement'

type FormattedHoldings = {
  pair: string
  volume: number
  usdValue: number | string
}

function HoldingsTable(data: { tradingData: tradingDataDef }) {
  const gridRef = useRef<AgGridReact<any>>(null)
  const [currentHoldings, setCurrentHoldings] = useState<any>([])
  const [formattedHoldings, setFormattedHoldings] = useState<
    FormattedHoldings[]
  >([])
  const [gridData] = useState<FormattedHoldings[]>(getFormattedHoldings)
  const gridStyle = useMemo(() => ({ width: '100%', height: '180px' }), [])
  const dispatch = useDispatch()
  const selectedPair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )

  const [columnDefs] = useState<any>([
    { field: 'pair' },
    { field: 'volume', cellRenderer: 'agAnimateShowChangeCellRenderer' },
    { field: 'usdValue', cellRenderer: 'agAnimateShowChangeCellRenderer' },
  ])
  const defaultColDef = useMemo<ColDef>(() => {
    return {
      flex: 1,
      filter: true,
    }
  }, [])
  const getRowClass = (params: any) => {
    if (params.data.pair === selectedPair) {
      return 'ag-selected-row'
    }
  }

  useEffect(() => {
    const holdings = getHoldingVolumesFromTrades(data.tradingData.trades)
    setCurrentHoldings(holdings.current)
  }, [JSON.stringify(data.tradingData.trades)])

  function getFormattedHoldings() {
    const holdings = getHoldingVolumesFromTrades(data.tradingData.trades)
    let updatedFormattedHoldings: FormattedHoldings[] = []
    Object.keys(holdings.current).forEach((pair: string) =>
      updatedFormattedHoldings.push({
        pair: pair,
        volume: holdings.current[pair],
        usdValue: getUSDValue(pair, holdings.current[pair]),
      }),
    )
    updatedFormattedHoldings = updatedFormattedHoldings.sort((a, b) =>
      typeof a.usdValue === 'string' || typeof b.usdValue === 'string'
        ? 0
        : b.usdValue - a.usdValue,
    )
    return updatedFormattedHoldings
  }

  useEffect(() => {
    setFormattedHoldings(getFormattedHoldings())
    if (gridRef.current && gridRef.current.api) {
      gridRef.current!.api.setGridOption('rowData', formattedHoldings)
      gridRef.current.api.refreshCells({ suppressFlash: false })
      gridRef.current.api.flashCells()
    }
  }, [JSON.stringify(data.tradingData.latestPrices), currentHoldings])

  const handleClick = (row: any) => {
    dispatch(filterSlice.actions.setPair(row.data?.pair))
  }

  function getUSDValue(pair: string, volume: number) {
    const lastPrice = data.tradingData.latestPrices[pair]
    if (lastPrice === undefined || lastPrice === null) {
      return 'N/A'
    } else {
      return volume * lastPrice
    }
  }

  function getRowNodeId(data: any) {
    return data.data.pair
  }

  return formattedHoldings.length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <div className={'ag-theme-quartz-dark'} style={gridStyle}>
      <AgGridReact
        ref={gridRef}
        getRowId={getRowNodeId}
        rowData={gridData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onRowClicked={(r) => handleClick(r)}
        rowSelection={'single'}
        getRowClass={getRowClass}
        animateRows={true}
        enableCellChangeFlash={true}
      />
    </div>
  )
}

export default HoldingsTable
