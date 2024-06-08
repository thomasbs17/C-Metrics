import { CircularProgress } from '@mui/material'
import { ColDef } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import '../../css/tables.css'
import { renderCellWithImage } from '../../utils/agGrid'
import { getPairLogo } from '../../utils/common'
import {
  Order,
  getHoldingVolumesFromTrades,
  tradingDataDef,
} from '../DataManagement'
import { filterSlice } from '../StateManagement'
import { useLocation } from 'react-router-dom'

type FormattedHoldings = {
  pair: string
  volume: number
  usdValue: number | string
  hasOpenSells: boolean
}

function HoldingsTable(data: { tradingData: tradingDataDef }) {

  const location = useLocation();

  const gridRef = useRef<AgGridReact<any>>(null)
  const [currentHoldings, setCurrentHoldings] = useState<any>([])
  const [formattedHoldings, setFormattedHoldings] = useState<
    FormattedHoldings[]
  >([])
  const [gridData] = useState<FormattedHoldings[]>(getFormattedHoldings)
  const gridStyle = useMemo(() => ({ width: '100%', height: location.pathname.endsWith('portfolio') ? '400px' : '210px'  }), [])
  const dispatch = useDispatch()

  const [columnDefs] = useState<any>([
    {
      field: 'pair',
      cellRenderer: (params: { value: string }) => {
        return renderCellWithImage(
          params.value,
          getPairLogo(data.tradingData, params.value),
        )
      },
    },
    {
      field: 'volume',
      cellRenderer: 'agAnimateShowChangeCellRenderer',
    },
    {
      field: 'usdValue',
      type: 'number',
      filter: 'agNumberColumnFilter',
      cellRenderer: 'agAnimateShowChangeCellRenderer',
    },
    { field: 'hasOpenSells' },
  ])
  const defaultColDef = useMemo<ColDef>(() => {
    return {
      flex: 1,
      filter: true,
    }
  }, [])

  useEffect(() => {
    const holdings = getHoldingVolumesFromTrades(data.tradingData.trades)
    setCurrentHoldings(holdings.current)
  }, [JSON.stringify(data.tradingData.trades)])

  function getFormattedHoldings() {
    const holdings = getHoldingVolumesFromTrades(data.tradingData.trades)
    let updatedFormattedHoldings: FormattedHoldings[] = []
    Object.keys(holdings.current).forEach((pair: string) => {
      const usdValue = getUSDValue(pair, holdings.current[pair])
      if (pair.includes('USD') && holdings.current[pair] > 0) {
        updatedFormattedHoldings.push({
          pair: pair,
          volume: holdings.current[pair],
          usdValue: usdValue,
          hasOpenSells: orderHasOpenSells(pair),
        })
      }
    })
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
      const filters = {
        usdValue: {
          type: 'greaterThan',
          filter: 0,
        },
      }
      gridRef.current!.api.setFilterModel(filters)
      gridRef.current!.api.applyColumnState({
        state: [{ colId: 'usdValue', sort: 'desc' }],
        defaultState: { sort: null },
      })
      gridRef.current.api.refreshCells({ suppressFlash: false })
    }
  }, [currentHoldings, JSON.stringify(data.tradingData.latestPrices)])

  const handleClick = (row: any) => {
    dispatch(filterSlice.actions.setPair(row.data?.pair))
  }

  function getUSDValue(pair: string, volume: number) {
    const lastPrice = data.tradingData.latestPrices![pair]
    if (lastPrice === undefined || lastPrice === null) {
      return 'N/A'
    } else {
      return Math.round(volume * lastPrice)
    }
  }

  function orderHasOpenSells(pair: string) {
    const orders = data.tradingData.orders
    let hasOpenSells = false
    orders.forEach((order: Order) => {
      if (
        order.asset_id === pair &&
        order.order_status === 'open' &&
        order.order_side === 'sell'
      ) {
        hasOpenSells = true
      }
    })
    return hasOpenSells
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
        animateRows={true}
      />
    </div>
  )
}

export default HoldingsTable
