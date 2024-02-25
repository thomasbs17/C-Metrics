import { Alert, CircularProgress, Stack } from '@mui/material'
import { ColDef, GridReadyEvent, RowClickedEvent } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import '../../css/charts.css'
import { tradingDataDef } from '../DataManagement'
import { filterSlice, type FilterState } from '../StateManagement'

function displayAsPercent(raw_number: number) {
  return (raw_number * 100).toFixed(2) + '%'
}

function Screening(data: { tradingData: tradingDataDef }) {
  const [gridData] = useState<any>(data.tradingData.screeningData)
  const gridRef = useRef<AgGridReact<any>>(null)
  const gridStyle = useMemo(() => ({ width: '100%', height: '180px' }), [])
  const [columnDefs] = useState<ColDef[]>([
    { field: 'pair' },
    { field: 'close' },
    { field: '24h_change' },
    { field: 'next_support' },
    { field: 'next_resistance' },
    { field: 'support_dist' },
    { field: 'rsi' },
    { field: 'bbl' },
    { field: 'technicals_score' },
    { field: 'book_score' },
    { field: 'score' },
    { field: 'potential_gain' },
  ])
  const defaultColDef = useMemo<ColDef>(() => {
    return {
      flex: 1,
      filter: true,
    }
  }, [])
  const dispatch = useDispatch()
  const selectedPair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )
  const getRowClass = (params: any) => {
    if (params.data.pair === selectedPair) {
      return 'ag-selected-row'
    }
  }

  function setDefaultGridSettings() {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.applyColumnState({
        state: [{ colId: 'technicals_score', sort: 'desc' }],
        defaultState: { sort: null },
      })
    }
  }

  const onGridReady = useCallback((event: GridReadyEvent) => {
    setDefaultGridSettings()
  }, [])

  const handleClick = (clickedPair: RowClickedEvent<any>) => {
    const pairDetails = clickedPair.data
    dispatch(filterSlice.actions.setPair(pairDetails.pair))
    dispatch(filterSlice.actions.setPairScoreDetails(pairDetails))
    dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
  }

  useEffect(() => {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current!.api.setGridOption(
        'rowData',
        data.tradingData.screeningData,
      )
    }
  }, [JSON.stringify(data.tradingData.screeningData)])

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
    <div className={'ag-theme-quartz-dark'} style={gridStyle}>
      <AgGridReact
        ref={gridRef}
        rowData={gridData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onRowClicked={(r) => handleClick(r)}
        onGridReady={onGridReady}
        rowSelection={'single'}
        getRowClass={getRowClass}
      />
    </div>
  )
}

export default Screening
