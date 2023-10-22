import {
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Link,
  Menu,
  MenuItem,
  Modal,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Skeleton,
  TextField,
  Theme,
  ToggleButtonGroup,
  Typography,
  useTheme
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
  handleClose?: any
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
      sx={{ marginTop: 3, padding: 1, width: '100%' }}
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
      props.handleClose()
    }
  }
  useEffect(() => {
    setSelectedValue(stateValue)
    navigate(`/trading?exchange=${exchange}&pair=${stateValue}`)
  }, [stateValue, props.data, navigate, exchange]);

  useEffect(() => {
    if (!props.data.includes(stateValue) && props.data.length > 0) {
      setSelectedValue(props.data[0])
      dispatch(filterSlice.actions.setPair(props.data[0]))
      dispatch(filterSlice.actions.setPairScoreDetails({}));
      dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
      navigate(`/trading?exchange=${exchange}&pair=${props.data[0]}`)
    }
  }, [dispatch, exchange, navigate, props.data, stateValue])

  return (
    <div>
      {
        props.data.length === 0 ?
          <Skeleton variant="rounded" height={40} width={'100%'} sx={{ marginTop: 3, padding: 1 }} /> :
          <Autocomplete
            clearIcon={false}
            options={props.data}
            sx={{ marginTop: 3, padding: 1 }}
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

interface MultipleSelectChipProps {
  label: string
  options: string[]
  defaultValue: string[]
}

function MultipleSelectChip(props: MultipleSelectChipProps) {
  const theme = useTheme();
  const [selectedValue, setSelectedValue] = useState<string[]>(props.defaultValue);

  const ITEM_HEIGHT = 48;
  const ITEM_PADDING_TOP = 8;
  const MenuProps = {
    PaperProps: {
      style: {
        maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
        width: 250,
      },
    },
  };

  const getStyles = (name: string, personName: readonly string[], theme: Theme) => {
    return {
      fontWeight:
        personName.indexOf(name) === -1
          ? theme.typography.fontWeightRegular
          : theme.typography.fontWeightMedium,
    };
  }

  const handleChange = (event: SelectChangeEvent<typeof selectedValue>) => {
    const { target: { value } } = event;
    setSelectedValue(
      // On autofill we get a stringified value.
      typeof value === 'string' ? value.split(',') : value,
    );
  };

  return (
    <div>
      <FormControl sx={{ marginTop: 3, padding: 1, width: '100%' }}>
        <InputLabel id={`${props.label}-label`}>{`${props.label}`}</InputLabel>
        <Select
          labelId={`${props.label}-label`}
          id={`${props.label}-multiple-chip`}
          // multiple
          value={selectedValue}
          onChange={handleChange}
          input={<OutlinedInput id="select-multiple-chip" label="Chip" />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map((value) => (
                <Chip key={value} label={value} />
              ))}
            </Box>
          )}
          MenuProps={MenuProps}
        >
          {props.options.map((name) => (
            <MenuItem
              key={name}
              value={name}
              style={getStyles(name, selectedValue, theme)}
            >
              {name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
}

export function TopBar(data: { tradingData: tradingDataDef }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const handleOpen = () => setModalIsOpen(true);
  const handleClose = () => setModalIsOpen(false);
  const [exchange, pair] = useSelector(
    (state: { filters: FilterState }) => [
      state.filters.exchange,
      state.filters.pair,
    ],
  )

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'left',
    transform: 'translateX(-50px)',
    opacity: '0',
    transition: 'opacity 1s, transform 1s',
    zIndex: 2,
    position: 'relative',
  }

  const modalStyle = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 800,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
  };
  const [filteredAssetTypes, setFilteredAssetTypes] = useState<string[]>([]);

  useEffect(() => {
    if (Object.keys(data.tradingData.markets).length !== 0) {
      let assetTypes: string[] = [];
      setFilteredAssetTypes(assetTypes);
      filtersSideAnimation(containerRef, data.tradingData.markets)
    }
  }, [data.tradingData.markets])


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
          <Button variant="text" size="large" onClick={handleOpen} sx={{ width: 200 }}>{`${exchange}: ${pair}`}</Button>
        </Col>
      </Row>
      <Modal
        open={modalIsOpen}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={modalStyle}>
          <Typography id="symbol-selection" variant="h6" component="h2">
            Symbol Selection
          </Typography>
          <Row>
            <Col>
              <ExchangeFilter data={data.tradingData.exchanges} />
            </Col>
            <Col>
              <MultipleSelectChip label='Networks' options={[]} defaultValue={[]} />
            </Col>
            <Col>
              <MultipleSelectChip label='Asset Types' options={filteredAssetTypes} defaultValue={[]} />
            </Col>
          </Row>
          <PairFilter data={Object.keys(data.tradingData.markets).sort()} handleClose={handleClose} />
        </Box>
      </Modal>
    </Container>
  )
}