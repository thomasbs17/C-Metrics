import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Modal,
  Select,
  SelectChangeEvent,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  RowClickedEvent,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router'
import {
  retrieveInfoFromCoinMarketCap,
  tradingDataDef,
} from '../DataManagement'
import { FilterState, filterSlice } from '../StateManagement'
import { GreedAndFear } from './Charts/Greed&Fear'
interface FilterProps {
  data: string[]
  callback?: any
}

function TradingTypeFilter() {
  const [selectedValue, setSelectedValue] = useState('Paper')
  const dispatch = useDispatch()

  const handleSelect = (
    event: React.MouseEvent<HTMLElement>,
    tradingType: string,
  ) => {
    setSelectedValue(tradingType)
    dispatch({ type: 'SET_TRADING_TYPE', payload: tradingType })
  }
  return (
    <ButtonGroup
      variant="text"
      aria-label="trading-type-choice"
      sx={{ marginLeft: '7%' }}
    >
      <Button variant="contained" size="small">
        Paper
      </Button>
      <Tooltip title="Coming soon..." placement="right">
        <span>
          <Button disabled size="small">
            Live
          </Button>
        </span>
      </Tooltip>
    </ButtonGroup>
  )
}

export function OhlcPeriodsFilter() {
  const [ohlcPeriod, setOhlcPeriod] = useState('1d')
  const dispatch = useDispatch()

  const handleSelect = (event: SelectChangeEvent) => {
    if (event.target.value !== null) {
      setOhlcPeriod(event.target.value)
      dispatch(filterSlice.actions.setOhlcPeriod(event.target.value))
    }
  }
  const timeFrames = {
    '1s': '1s',
    '1m': '1m',
    '3m': '3m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '2h': '2h',
    '4h': '4h',
    '6h': '6h',
    '8h': '8h',
    '12h': '12h',
    '1d': '1d',
    '3d': '3d',
    '1w': '1w',
    '1M': '1M',
  }

  return (
    <div style={{ position: 'relative', marginLeft: '25%', zIndex: 3 }}>
      <FormControl>
        <InputLabel id="ohlc-period-time-label">Time</InputLabel>
        <Select
          id="ohlc-period-time"
          value={ohlcPeriod}
          label="ohlc-period-selection"
          onChange={handleSelect}
          size="small"
        >
          {Object.entries(timeFrames).map(([value, label]) => (
            <MenuItem key={value} value={value} sx={{ maxHeight: 20 }}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  )
}

function ExchangeFilter(props: FilterProps) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [selectedValue, setSelectedValue] = useState('')
  const stateValue = useSelector(
    (state: { filters: FilterState }) => state.filters.exchange,
  )
  const pair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )
  const handleSelect = (event: React.ChangeEvent<{}>, value: string | null) => {
    if (value !== null) {
      setSelectedValue(value)
      dispatch(filterSlice.actions.setExchange(value))
      dispatch(filterSlice.actions.setPairScoreDetails({}))
      dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
      navigate(`/trading?exchange=${value}&pair=${pair}`)
    }
  }
  return (
    <div style={{ width: 500 }}>
      <Autocomplete
        clearIcon={false}
        options={props.data}
        sx={{ marginTop: 3, padding: 1, width: '100%' }}
        value={selectedValue !== '' ? selectedValue : stateValue}
        onChange={handleSelect}
        renderInput={(params) => (
          <TextField {...params} label={`Exchange (${props.data.length})`} />
        )}
      />
    </div>
  )
}

function PairFilter(props: FilterProps) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )
  const [exchange, pair] = useMemo(
    () => [filterState.exchange, filterState.pair],
    [filterState.exchange, filterState.pair],
  )

  const [selectedValue, setSelectedValue] = useState(pair)

  useEffect(() => {
    if (!props.data.includes(pair) && props.data.length > 0) {
      setSelectedValue(props.data[0])
      dispatch(filterSlice.actions.setPair(props.data[0]))
      dispatch(filterSlice.actions.setPairScoreDetails({}))
      dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
      navigate(`/trading?exchange=${exchange}&pair=${props.data[0]}`)
    }
  }, [exchange, props.data, pair])

  return (
    <div style={{ width: 200 }}>
      {props.data.length === 0 ? (
        <Skeleton
          variant="rounded"
          height={40}
          width={'100%'}
          sx={{ marginTop: 3, padding: 1 }}
        />
      ) : (
        <Autocomplete
          clearIcon={false}
          options={props.data}
          sx={{ marginTop: 3, padding: 1 }}
          value={selectedValue !== '' ? selectedValue : pair}
          onChange={props.callback}
          renderInput={(params) => (
            <TextField {...params} label={`Pair (${props.data.length})`} />
          )}
        />
      )}
    </div>
  )
}

function filtersSideAnimation(
  containerRef: React.RefObject<HTMLDivElement>,
  markets: any,
) {
  const container = containerRef.current
  if (container) {
    container.style.opacity = '1'
    container.style.transform = 'translateX(0)'
  }
}

interface PairSelectionModalProps {
  data: tradingDataDef
  modalIsOpen: boolean
  handleClose: () => void
}

function PairSelectionModal(props: PairSelectionModalProps) {
  const gridRef = useRef<AgGridReact>(null)
  const [rowData, setRowData] = useState<any[]>([])
  const [gridApi, setGridApi] = useState<GridApi>()
  const tableSise = useMemo(() => '400px', [])
  const gridStyle = useMemo(() => ({ width: '100%', height: tableSise }), [])
  const exchange = useSelector(
    (state: { filters: FilterState }) => state.filters.exchange,
  )
  const dispatch = useDispatch()
  const navigate = useNavigate()

  function formatDate(rawTimeStamp: number) {
    const date = new Date(rawTimeStamp)
    const year = date.getFullYear()
    const month = ('0' + (date.getMonth() + 1)).slice(-2) // Month is zero-based
    const day = ('0' + date.getDate()).slice(-2)
    return `${year}/${month}/${day}`
  }

  const pairDropDownCallback = (
    event: React.ChangeEvent<{}>,
    value: string | null,
  ) => {
    dispatch(filterSlice.actions.setPair(value))
    dispatch(filterSlice.actions.setLoadingComponents(['ohlcv', true]))
    navigate(`/trading?exchange=${exchange}&pair=${value}`)
    props.handleClose()
  }

  const handleAgGridClick = (event: RowClickedEvent<any, any>) => {
    const pair = event.data.symbol
    dispatch(filterSlice.actions.setPair(pair))
    dispatch(filterSlice.actions.setLoadingComponents(['ohlcv', true]))
    navigate(`/trading?exchange=${exchange}&pair=${pair}`)
    props.handleClose()
  }

  const [columnDefs] = useState<ColDef[]>([
    { field: 'symbol' },
    { field: 'exchange' },
    { field: 'type' },
    { field: 'strike' },
    {
      field: 'expiry',
      cellDataType: 'date',
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'created',
      cellDataType: 'date',
      valueFormatter: (params) => formatDate(params.value),
    },
  ])

  const modalStyle = useMemo(
    () => ({
      position: 'absolute' as 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 800,
      bgcolor: 'background.paper',
      border: '2px solid #000',
      borderRadius: 10,
      boxShadow: 24,
      height: 600,
      p: 4,
    }),
    [],
  )

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      flex: 1,
      filter: true,
    }
  }, [])

  function getGridData() {
    let gridData: any = []
    Object.keys(props.data.markets).forEach((pair: string) => {
      let pairDetails = props.data.markets[pair]
      pairDetails['exchange'] = exchange
      gridData.push(pairDetails)
    })
    return gridData
  }

  useEffect(() => {
    if (gridApi) {
      const gridData: any = getGridData()
      setRowData(gridData)
      gridApi!.setGridOption('rowData', gridData)
    }
  }, [gridApi, exchange, props.data.markets])

  const onGridReady = useCallback((event: GridReadyEvent) => {
    const gridData: any = getGridData()
    setRowData(gridData)
    setGridApi(event.api)
  }, [])

  return (
    <Modal
      open={props.modalIsOpen}
      onClose={props.handleClose}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Box sx={modalStyle}>
        <Typography id="symbol-selection" variant="h6" component="h2">
          Symbol Selection
        </Typography>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ExchangeFilter data={props.data.exchanges} />
          <PairFilter
            data={Object.keys(props.data.markets)}
            callback={pairDropDownCallback}
          />
        </div>
        <Row>
          <div
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {Object.keys(props.data.markets).length === 0 ? (
              <div
                style={{
                  height: '100%',
                  width: '100%',
                  position: 'relative',
                  left: '50%',
                  marginTop: '20%',
                }}
              >
                <CircularProgress />
              </div>
            ) : (
              <div className={'ag-theme-quartz-dark'} style={gridStyle}>
                <AgGridReact
                  ref={gridRef}
                  rowData={rowData}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  onRowClicked={(r) => handleAgGridClick(r)}
                  onGridReady={onGridReady}
                  rowSelection={'single'}
                />
              </div>
            )}
          </div>
        </Row>
      </Box>
    </Modal>
  )
}

export function PairSelectionWidget(data: { tradingData: tradingDataDef }) {
  const [cryptoInfo, setCryptoInfo] = useState<any>({})
  const [cryptoMetaData, setCryptoMetaData] = useState<any>(undefined)
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )
  const [displayName, setDisplayName] = useState<string>('')
  const [modalIsOpen, setModalIsOpen] = useState(false)
  const handleOpen = () => setModalIsOpen(true)

  const handleClose = () => {
    setModalIsOpen(false)
  }

  useEffect(() => {
    setCryptoInfo(
      retrieveInfoFromCoinMarketCap(
        filterState.pair,
        data.tradingData.coinMarketCapMapping,
      ),
    )
  }, [
    filterState.pair,
    filterState.exchange,
    JSON.stringify(data.tradingData.coinMarketCapMapping),
  ])
  useEffect(() => {
    if (cryptoInfo) {
      const maxStringLength = 30
      let name = `${filterState.exchange}: ${filterState.pair.replace('/', '-')} (${cryptoInfo.name})`
      name =
        name.length > maxStringLength
          ? `${name.slice(0, maxStringLength)}...`
          : name
      setDisplayName(name)
      if (
        Object.keys(cryptoInfo).length > 0 &&
        data.tradingData.cryptoMetaData.length !== 0
      ) {
        if (Object.keys(data.tradingData.cryptoMetaData).includes('data')) {
          let newData = data.tradingData.cryptoMetaData['data']
          const pairId = Object.keys(newData)[0]
          newData.logo = `https://s2.coinmarketcap.com/static/img/coins/64x64/${pairId}.png`
          setCryptoMetaData(newData)
        }
      }
    }
  }, [cryptoInfo])

  return (
    <div>
      <Tooltip
        title={
          cryptoInfo
            ? `${filterState.exchange}: ${filterState.pair} (${cryptoInfo.name})`
            : ''
        }
        placement="top"
        followCursor
      >
        <Button
          variant="text"
          size="large"
          onClick={handleOpen}
          sx={{
            width: 350,
            height: 30,
            justifyContent: 'flex-start',
            fontSize: 12,
            marginTop: 2,
          }}
          startIcon={
            cryptoMetaData === undefined ? (
              <CircularProgress />
            ) : (
              <Avatar src={cryptoInfo?.logo} />
            )
          }
        >
          {displayName}
        </Button>
      </Tooltip>
      <PairSelectionModal
        data={data.tradingData}
        modalIsOpen={modalIsOpen}
        handleClose={handleClose}
      />
    </div>
  )
}

export function TopBar(data: { tradingData: tradingDataDef }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (Object.keys(data.tradingData.markets).length !== 0) {
      const assetTypes: string[] = []
      filtersSideAnimation(containerRef, data.tradingData.markets)
    }
  }, [data.tradingData.markets])

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    transform: 'translateX(-50px)',
    opacity: '0',
    transition: 'opacity 1s, transform 1s',
  }

  return (
    <Container fluid ref={containerRef} style={containerStyle}>
      <Row style={{ padding: '10px', width: '100%' }}>
        <Col>
          <TradingTypeFilter />
        </Col>
        {Object.keys(data.tradingData.greedAndFearData).length !== 0 && (
          <Col>
            <GreedAndFear data={data.tradingData.greedAndFearData} />
          </Col>
        )}
      </Row>
    </Container>
  )
}
