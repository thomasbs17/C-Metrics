import {
  Autocomplete,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Link,
  Menu,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  ToggleButtonGroup,
} from '@mui/material'
import Highcharts from 'highcharts'
import HighchartsMore from 'highcharts/highcharts-more'
import SolidGauge from 'highcharts/modules/solid-gauge'
import { useEffect, useRef, useState } from 'react'
import { Col, Container, Row, ToggleButton } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router'
import { tradingDataDef } from '../DataManagement'
import { FilterState, filterSlice } from '../StateManagement'

// Initialize the modules
HighchartsMore(Highcharts)
SolidGauge(Highcharts)



type FilterProps = {
  data: Array<string>
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
    <ToggleButtonGroup
      color="primary"
      value={selectedValue}
      exclusive
      onChange={handleSelect}
      aria-label="Platform"
    >
      <ToggleButton value="paper" variant="success">
        Paper
      </ToggleButton>
      <ToggleButton disabled value="live" variant="error">
        Live
      </ToggleButton>
    </ToggleButtonGroup>
  )
}


function OhlcPeriodsFilter() {
  const [ohlcPeriod, setOhlcPeriod] = useState('1d');
  const dispatch = useDispatch();

  const handleSelect = (event: SelectChangeEvent) => {
    if (event.target.value !== null) {
      setOhlcPeriod(event.target.value)
      dispatch(filterSlice.actions.setOhlcPeriod(event.target.value))
    }
  };
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
  };

  return (
    <FormControl fullWidth>
      <InputLabel id="ohlc-period-time-label">Time</InputLabel>
      <Select
        id="ohlc-period-time"
        value={ohlcPeriod}
        label="Age"
        onChange={handleSelect}
        size="small"
      >
        {Object.entries(timeFrames).map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
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
      dispatch(filterSlice.actions.setPairScoreDetails({}));
      dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
      navigate(`/trading?exchange=${value}&pair=${pair}`)
    }
  }
  return (
    <Autocomplete
      clearIcon={false}
      options={props.data}
      size="small"
      sx={{ width: 200 }}
      value={selectedValue != '' ? selectedValue : stateValue}
      onChange={handleSelect}
      renderInput={(params) => (
        <TextField {...params} label={`Exchange (${props.data.length})`} />
      )}
    />
  )
}

function PairFilter(props: FilterProps) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [exchange, stateValue] = useSelector(
    (state: { filters: FilterState }) => [
      state.filters.exchange,
      state.filters.pair,
    ],
  )
  const [selectedValue, setSelectedValue] = useState(stateValue)
  const handleSelectPair = (
    event: React.ChangeEvent<{}>,
    value: string | null,
  ) => {
    if (value !== null && value !== undefined) {
      setSelectedValue(value)
      dispatch(filterSlice.actions.setPair(value))
      navigate(`/trading?exchange=${exchange}&pair=${value}`)
    }
  }
  useEffect(() => {
    setSelectedValue(stateValue)
    navigate(`/trading?exchange=${exchange}&pair=${stateValue}`)
  }, [stateValue, props.data]);

  useEffect(() => {
    if (!props.data.includes(stateValue) && props.data.length > 0) {
      setSelectedValue(props.data[0])
      dispatch(filterSlice.actions.setPair(props.data[0]))
      dispatch(filterSlice.actions.setPairScoreDetails({}));
      dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
      navigate(`/trading?exchange=${exchange}&pair=${props.data[0]}`)
    }
  }, [exchange, props.data])

  return (
    <div>
      {
        props.data.length === 0 ?
          <CircularProgress /> :
          <Autocomplete
            clearIcon={false}
            options={props.data}
            size="small"
            sx={{ width: 200 }}
            value={selectedValue !== '' ? selectedValue : stateValue}
            onChange={handleSelectPair}
            renderInput={(params) => (
              <TextField {...params} label={`Pair (${props.data.length})`} />
            )}
          />
      }
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

const containerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'left',
  transform: 'translateX(-50px)',
  opacity: '0',
  transition: 'opacity 1s, transform 1s',
  zIndex: 2,
  position: 'relative',
}


function NavigationMenu() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const pages: any = { 'Home': '', 'Trading': 'trading', 'Portfolio': 'portfolio', 'Sign Up': 'registration' }

  return (
    <div>
      <Button
        id="menu-button"
        aria-controls={open ? 'basic-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
      >
        Menu
      </Button>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        sx={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        MenuListProps={{
          'aria-labelledby': 'basic-button',
        }}
      >
        {Object.keys(pages).map((page: string) => (
          <Link href={`/${[pages[page]]}`} sx={{ textDecoration: 'none', color: 'white', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <MenuItem
              component={Link}
              onClick={handleClose}
            >
              {page}
            </MenuItem>
          </Link>
        ))}
      </Menu>
    </div >
  )
}


export function TopBar(data: { tradingData: tradingDataDef }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    filtersSideAnimation(containerRef, data.tradingData.markets)
  }, [data.tradingData.markets]);
  return (
    <Container fluid ref={containerRef} style={containerStyle}>
      <Row style={{ padding: '10px' }}>
        <Col style={{ maxWidth: 100 }}>
          <NavigationMenu />
        </Col>
        <Col>
          <TradingTypeFilter />
        </Col>
        <Col>
          <OhlcPeriodsFilter />
        </Col>
        <Col>
          <ExchangeFilter data={data.tradingData.exchanges} />
        </Col>
        <Col>
          <PairFilter data={Object.keys(data.tradingData.markets).sort()} />
        </Col>
      </Row>
    </Container>
  )
}