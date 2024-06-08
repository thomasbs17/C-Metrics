import { Alert, CircularProgress, Stack } from '@mui/material'
import {
  ColDef,
  GetContextMenuItemsParams,
  GetRowIdFunc,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  MenuItemDef,
  RowClickedEvent,
  ValueFormatterParams,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import '../../css/charts.css'
import { tradingDataDef } from '../DataManagement'
import { filterSlice } from '../StateManagement'
import { defaultValueFormat } from '../../utils/agGrid'

const RSI_THRESHOLD = 35

function Screening(data: { tradingData: tradingDataDef }) {
  const gridRef = useRef<AgGridReact>(null)
  const containerStyle = useMemo(() => ({ width: '100%', height: '210px' }), [])
  const gridStyle = useMemo(() => ({ width: '100%', height: '210px' }), [])
  const [rowData, setRowData] = useState<any[]>()
  const [gridApi, setGridApi] = useState<GridApi>()

  const [columnDefs] = useState<ColDef[]>([
    { field: 'pair' },
    { field: 'close', hide: true },
    {
      field: '24h_change',
      headerTooltip: 'Today price change',
      valueFormatter: (params) => defaultValueFormat(params),
      cellStyle: (params) => {
        return { color: params.value < 0 ? 'red' : 'green' }
      },
    },
    { field: 'next_support', headerTooltip: 'Next support' },
    { field: 'next_resistance', headerTooltip: 'Next resistance' },
    {
      field: 'distance_to_support',
      type: 'number',
      headerTooltip: '% distance to next support',
      filter: 'agNumberColumnFilter',
      menuTabs: ['filterMenuTab'],
      valueFormatter: (params) => defaultValueFormat(params),
      cellStyle: (params) => {
        return { color: params.value < 0 ? 'red' : 'green' }
      },
    },
    {
      field: 'rsi',
      headerTooltip: 'RSI',
      type: 'number',
      filter: 'agNumberColumnFilter',
    },
    {
      field: 'bbl',
      headerTooltip: '% distance to lower Bollinger Band',
      valueFormatter: (params) => defaultValueFormat(params),
      cellStyle: (params) => {
        return { color: params.value < 0 ? 'red' : 'green' }
      },
    },
    {
      field: 'score',
      headerTooltip: 'Score',
      type: 'number',
      hide: true,
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => defaultValueFormat(params),
      cellStyle: (params) => {
        return { color: params.value < 0 ? 'red' : 'green' }
      },
    },
    {
      field: 'available_data_length',
      type: 'number',
      hide: true,
      filter: 'agNumberColumnFilter',
    },
    {
      field: 'upside',
      headerTooltip: 'Upside %',
      type: 'number',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => defaultValueFormat(params),
      cellStyle: (params) => {
        return { color: 'green' }
      },
    },
    {
      field: 'downside',
      headerTooltip: 'Downside %',
      type: 'number',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => defaultValueFormat(params),
      cellStyle: (params) => {
        return { color: 'red' }
      },
    },
    {
      field: 'risk_reward_ratio',
      headerTooltip: 'Risk Reward Ratio',
      type: 'number',
      filter: 'agNumberColumnFilter',
      cellStyle: (params) => {
        return { color: params.value < 0 ? 'red' : 'green' }
      },
    },
  ])
  const defaultColDef = useMemo<ColDef>(() => {
    return {
      flex: 1,
      filter: true,
      enableCellChangeFlash: true,
      valueSetter: (params: any) => {
        return params.newValue
      },
    }
  }, [])

  const dispatch = useDispatch()

  useEffect(() => {
    if (gridApi) {
      gridApi.setGridOption('rowData', data.tradingData.screeningData)
    }
    setDefaultGridSettings()
  }, [gridApi, data.tradingData.screeningData])


  function closeToPocFilter() {
    if (gridApi) {
      const filters = {
        rsi: {
          type: 'lessThan',
          filter: RSI_THRESHOLD,
        },
        available_data_length: {
          type: 'greaterThan',
          filter: 150,
        },
        distance_to_support: {
          type: 'lessThan',
          filter: 0.1,
        },
        upside: {
          type: 'greaterThan',
          filter: 0.1,
        },
        risk_reward_ratio: {
          type: 'greaterThan',
          filter: 0,
        },
        score: {
          type: 'greaterThan',
          filter: 0,
        },
      }
      gridApi.setFilterModel(filters)
      gridApi.applyColumnState({
        state: [{ colId: 'score', sort: 'desc' }],
        defaultState: { sort: null },
      })
    }
  }

  function setDefaultGridSettings() {
    if (gridApi) {
      const filters = {
        rsi: {
          type: 'lessThan',
          filter: RSI_THRESHOLD,
        },
        available_data_length: {
          type: 'greaterThan',
          filter: 150,
        },
        // distance_to_support: {
        //   type: 'lessThan',
        //   filter: 0.1,
        // },
        // upside: {
        //   type: 'greaterThan',
        //   filter: 0.1,
        // },
        // risk_reward_ratio: {
        //   type: 'greaterThan',
        //   filter: 0,
        // },
        score: {
          type: 'greaterThan',
          filter: 0,
        },
      }
      gridApi.setFilterModel(filters)
      gridApi.applyColumnState({
        state: [{ colId: 'score', sort: 'desc' }],
        defaultState: { sort: null },
      })
    }
  }

  const onGridReady = useCallback((event: GridReadyEvent) => {
    setRowData(data.tradingData.screeningData)
    setGridApi(event.api)
    event.api.setGridOption('rowData', data.tradingData.screeningData)
    setDefaultGridSettings()
  }, [])

  const handleClick = (clickedPair: RowClickedEvent<any>) => {
    const pairDetails = clickedPair.data
    dispatch(filterSlice.actions.setPair(`${pairDetails.pair}`))
    dispatch(filterSlice.actions.setPairScoreDetails(pairDetails))
    dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
  }

  const getRowId = useMemo<GetRowIdFunc>(() => {
    return (params: GetRowIdParams) => params.data.pair
  }, [])

  function clearAllFilters(event: any) {
    if (event.api) {
      setGridApi(event.api)
      event.api.setFilterModel(null)
    }
  }

  const getContextMenuItems = useCallback(
    (params: GetContextMenuItemsParams): (string | MenuItemDef)[] => {
      var result: (string | MenuItemDef)[] = [
        {
          name: 'Clear Filters',
          action: (e) => clearAllFilters(e),
          icon: '<img width="20" height="20" src="https://static-00.iconduck.com/assets.00/filter-remove-icon-512x440-0mp279cb.png" alt="remove-filters"/>',
        },
        {
          name: 'Set Filters',
          action: () => setDefaultGridSettings(),
        },
        {
          name: 'Close to Point of Control',
          action: () => closeToPocFilter(),
          icon: '🤏'
        },
        'separator',
        'copy',
        'resetColumns',
        'csvExport',
        'separator',
      ]
      return result
    },
    [],
  )

  return data.tradingData.screeningData === false ? (
    <Stack
      direction="row"
      justifyContent="center"
      alignItems="center"
      sx={{ width: 1, height: '200px' }}
    >
      <Alert severity="error">Could not load screening data.</Alert>
    </Stack>
  ) : data.tradingData.screeningData.length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <div style={containerStyle}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className={'ag-theme-quartz-dark'} style={gridStyle}>
          <AgGridReact
            getRowId={getRowId}
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onRowClicked={(r) => handleClick(r)}
            onGridReady={onGridReady}
            rowSelection={'single'}
            getContextMenuItems={getContextMenuItems}
            suppressCopyRowsToClipboard={true}
          />
        </div>
      </div>
    </div>
  )
}

export default Screening
