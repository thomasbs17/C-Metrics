import { CircularProgress } from '@mui/material'
import {
  ColDef,
  GridReadyEvent,
  RowClickedEvent,
  SideBarDef,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import '../../css/charts.css'
import { Trade, type tradingDataDef } from '../DataManagement'
import { filterSlice, type FilterState } from '../StateManagement'

interface TableProps {
  trades: Trade[]
}

function formatTimeStamp(originalDate: any) {
  let formattedDate = originalDate.substring(0, 19)
  formattedDate = formattedDate.replace('T', ' ')
  return formattedDate
}

function TradeTable({ trades }: TableProps) {
  const gridRef = useRef<AgGridReact<Trade[]>>(null)
  const dispatch = useDispatch()
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )
  const [pair, selectedOrder, exchange] = useMemo(
    () => [filterState.pair, filterState.selectedOrder, filterState.exchange],
    [filterState.pair, filterState.selectedOrder, filterState.exchange],
  )

  const [colDefs, setColDefs] = useState<ColDef<Trade>[]>([])

  async function setDefaultGridSettings() {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.applyColumnState({
        state: [{ colId: 'execution_tmstmp', sort: 'desc' }],
        defaultState: { sort: null },
      })
      gridRef
        .current!.api.setColumnFilterModel('asset_id', {
          values: [pair],
        })
        .then(() => {
          gridRef.current!.api.onFilterChanged()
        })
      gridRef.current!.api.onFilterChanged()
    }
  }

  useEffect(() => {
    setColDefs([
      { field: 'execution_tmstmp' },
      { field: 'trading_env', hide: true },
      { field: 'broker_id' },
      { field: 'asset_id', filter: 'agSetColumnFilter' },
      {
        field: 'trade_side',
        cellRenderer: (params: { value: string }) => {
          const action = params.value.toLowerCase()
          let cellClass = ''
          if (action === 'buy') {
            cellClass = 'buy-cell'
          } else if (action === 'sell') {
            cellClass = 'sell-cell'
          }
          return <span className={cellClass}>{action}</span>
        },
      },
      { field: 'trade_volume' },
      { field: 'trade_price' },
    ])
    setDefaultGridSettings()
  }, [trades, pair])

  const handleClick = (clickedTrade: RowClickedEvent<Trade, any>) => {
    const trade = clickedTrade.data
    if (trade !== undefined) {
      if (trade.trade_id !== selectedOrder[2]) {
        dispatch(
          filterSlice.actions.setSelectedOrder([
            trade.execution_tmstmp,
            trade.trade_price,
            trade.trade_id,
          ]),
        )
        if (pair !== trade.asset_id) {
          dispatch(filterSlice.actions.setPair(trade.asset_id))
        }
        if (exchange !== trade.broker_id) {
          dispatch(filterSlice.actions.setExchange(trade.broker_id))
        }
      } else {
        dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
      }
    }
  }

  const onGridReady = useCallback((event: GridReadyEvent) => {
    setDefaultGridSettings()
  }, [])

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      flex: 1,
      filter: true,
    }
  }, [])

  const sideBar = useMemo<
    SideBarDef | string | string[] | boolean | null
  >(() => {
    return {
      toolPanels: [
        {
          id: 'columns',
          labelDefault: 'Columns',
          labelKey: 'columns',
          iconKey: 'columns',
          toolPanel: 'agColumnsToolPanel',
          minWidth: 225,
          width: 225,
          maxWidth: 225,
        },
        {
          id: 'filters',
          labelDefault: 'Filters',
          labelKey: 'filters',
          iconKey: 'filter',
          toolPanel: 'agFiltersToolPanel',
          minWidth: 180,
          maxWidth: 400,
          width: 250,
        },
      ],
      position: 'left',
      defaultToolPanel: 'filters',
      hiddenByDefault: true,
    }
  }, [])

  return trades.length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <div
      className={'ag-theme-quartz-dark'}
      style={{ width: '100%', height: '180px' }}
    >
      <AgGridReact
        ref={gridRef}
        rowData={trades}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        sideBar={sideBar}
        onRowClicked={(r) => handleClick(r)}
        onGridReady={onGridReady}
        rowSelection={'single'}
        suppressCopyRowsToClipboard={true}
      />
    </div>
  )
}

function Trades(data: { tradingData: tradingDataDef }) {
  return <TradeTable trades={data.tradingData.trades} />
}

export default Trades
