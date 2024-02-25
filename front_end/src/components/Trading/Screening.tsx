import { Alert, CircularProgress, Stack } from '@mui/material'
import {
  ColDef,
  GridReadyEvent,
  RowClickedEvent,
  SideBarDef,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { tradingDataDef } from '../DataManagement'
import { filterSlice, type FilterState } from '../StateManagement'
import '../../css/charts.css'

function displayAsPercent(raw_number: number) {
  return (raw_number * 100).toFixed(2) + '%'
}

function Screening(data: { tradingData: tradingDataDef }) {
  const dispatch = useDispatch()
  const selectedPair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )
  const gridRef = useRef<AgGridReact<any>>(null)
  const [colDefs, setColDefs] = useState<ColDef<any>[]>([])
  const [scrollPosition, setScrollPosition] = useState(0)
  const [selectedRows, setSelectedRows] = useState([])

  useEffect(() => {
    if (gridRef.current && gridRef.current.api) {
      const { top } = gridRef.current.api.getVerticalPixelRange()
      setScrollPosition(top)
    }
  }, [data.tradingData.screeningData])

  useEffect(() => {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.ensureIndexVisible(scrollPosition, 'middle')

      gridRef.current.api.forEachNode((node: any) => {
        const isSelected = selectedRows.some(
          (row: any) => selectedPair === node.pair,
        )
        node.setSelected(isSelected)
      })
    }
  }, [scrollPosition, selectedRows])

  function setDefaultGridSettings() {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.applyColumnState({
        state: [{ colId: 'score', sort: 'desc' }],
        defaultState: { sort: null },
      })
      // gridRef.current.api
      //   .setColumnFilterModel('pair', { values: [selectedPair] })
      //   .then(() => {
      //     gridRef.current!.api.onFilterChanged()
      //   })
    }
  }

  const handleClick = (clickedPair: RowClickedEvent<any>) => {
    const pairDetails = clickedPair.data
    dispatch(filterSlice.actions.setPair(pairDetails.pair))
    dispatch(filterSlice.actions.setPairScoreDetails(pairDetails))
    dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
  }

  useEffect(() => {
    setColDefs([
      { field: 'pair' },
      { field: 'close' },
      { field: 'next_support', filter: 'agSetColumnFilter' },
      { field: 'next_resistance' },
      { field: 'support_dist' },
      { field: 'rsi' },
      { field: 'bbl' },
      { field: 'technicals_score' },
      { field: 'book_score' },
      { field: 'score' },
      { field: 'potential_gain' },
    ])
    setDefaultGridSettings()
  }, [])

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
    <div
      className={'ag-theme-quartz-dark'}
      style={{ width: '100%', height: '180px' }}
    >
      <AgGridReact
        ref={gridRef}
        rowData={data.tradingData.screeningData}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        sideBar={sideBar}
        onRowClicked={(r) => handleClick(r)}
        onGridReady={onGridReady}
        rowSelection={'single'}
        // immutableData={true}
      />
    </div>
  )
}

export default Screening
