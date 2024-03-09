import CandlestickChartOutlinedIcon from '@mui/icons-material/CandlestickChart'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import EditIcon from '@mui/icons-material/Edit'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  MenuProps,
  Snackbar,
  Tooltip,
  Typography,
  alpha,
  styled
} from '@mui/material'
import Divider from '@mui/material/Divider'
import { ColDef, GridReadyEvent, SideBarDef } from 'ag-grid-community'
import 'ag-grid-enterprise'
import { AgGridReact, CustomCellRendererProps } from 'ag-grid-react'
import axios from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import '../../css/charts.css'
import '../../css/tables.css'
import { type Order, type tradingDataDef } from '../DataManagement'
import { filterSlice, type FilterState } from '../StateManagement'

interface TableProps {
  orders: Order[]
}

const StyledMenu = styled((props: MenuProps) => (
  <Menu
    elevation={0}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'right',
    }}
    transformOrigin={{
      vertical: 'top',
      horizontal: 'right',
    }}
    {...props}
  />
))(({ theme }) => ({
  '& .MuiPaper-root': {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    color:
      theme.palette.mode === 'light'
        ? 'rgb(55, 65, 81)'
        : theme.palette.grey[300],
    boxShadow:
      'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    '& .MuiMenu-list': {
      padding: '4px 0',
    },
    '& .MuiMenuItem-root': {
      '& .MuiSvgIcon-root': {
        fontSize: 18,
        color: theme.palette.text.secondary,
        marginRight: theme.spacing(1.5),
      },
      '&:active': {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity,
        ),
      },
    },
  },
}))

function CustomizedMenus(props: CustomCellRendererProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleViewOnChart = () => {
    props.context.displayChartForSelectedOrder(props.node.data)
    handleClose()
  }

  const handleDeleteOrder = () => {
    props.context.cancelOrder(props.node.data.order_dim_key)
    handleClose()
  }

  return (
    <div>
      <Tooltip title="View on Chart">
        <IconButton
          aria-label="more"
          id="long-button"
          size="small"
          onClick={handleViewOnChart}
        >
          < CandlestickChartOutlinedIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Order Options">
        <IconButton
          aria-label="more"
          id="long-button"
          aria-controls={open ? 'long-menu' : undefined}
          aria-expanded={open ? 'true' : undefined}
          aria-haspopup="true"
          size="small"
          onClick={handleClick}
        >
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
      <StyledMenu
        id="demo-customized-menu"
        MenuListProps={{
          'aria-labelledby': 'demo-customized-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        {['part_fill', 'open'].includes(props.node.data.order_status) && (
          <div>
            <MenuItem onClick={handleClose} disableRipple>
              <EditIcon />
              Edit
            </MenuItem>
            <MenuItem onClick={handleDeleteOrder} disableRipple>
              <DeleteForeverIcon />
              Delete
            </MenuItem>
          </div>
        )}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={handleViewOnChart} disableRipple>
          <CandlestickChartOutlinedIcon />
          View on Chart
        </MenuItem>
        <MenuItem onClick={handleClose} disableRipple>
          <MoreHorizIcon />
          More
        </MenuItem>
      </StyledMenu>
    </div>
  )
}

function OrderStatusChip(props: CustomCellRendererProps) {
  const orderStatus = props.node.data.order_status
  if (orderStatus == 'open') {
    return (
      <Chip label={orderStatus} color="info" variant="outlined" size="small" />
    )
  } else if (orderStatus == 'executed') {
    return (
      <Chip
        label={orderStatus}
        color="success"
        variant="outlined"
        size="small"
      />
    )
  } else if (orderStatus == 'cancelled') {
    return (
      <Chip
        label={orderStatus}
        color="warning"
        variant="outlined"
        size="small"
      />
    )
  }
}

function LinearProgressWithLabel(props: CustomCellRendererProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box sx={{ width: '100%', mr: 1 }}>
        <LinearProgress
          variant="determinate"
          value={props.node.data.fill_pct * 100}
        />
      </Box>
      <Box sx={{ minWidth: 35 }}>
        <Typography variant="body2" color="text.secondary">{`${Math.round(
          props.node.data.fill_pct * 100,
        )}%`}</Typography>
      </Box>
    </Box>
  )
}

function OrderTable({ orders }: TableProps) {
  const gridRef = useRef<AgGridReact<Order[]>>(null)
  const dispatch = useDispatch()
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )
  const [pair, exchange] = useMemo(
    () => [filterState.pair, filterState.exchange],
    [filterState.pair, filterState.exchange],
  )
  const [snackIsOpen, setSnackIsOpen] = useState<boolean>(false)
  const [colDefs, setColDefs] = useState<ColDef<Order>[]>([])
  const [selectedOrder, setSelectedOrder] = useState<[string, string, string]>([
    '',
    '',
    '',
  ])

  async function setDefaultGridSettings() {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.applyColumnState({
        state: [{ colId: 'order_creation_tmstmp', sort: 'desc' }],
        defaultState: { sort: null },
      })
      await gridRef.current.api.setColumnFilterModel('asset_id', {
        filterType: 'text',
        type: 'contains',
        filter: pair,
      })
      await gridRef.current.api.setColumnFilterModel('order_status', {
        filterType: 'text',
        type: 'contains',
        filter: 'open',
      })
      gridRef.current!.api.onFilterChanged()
    }
  }

  useEffect(() => {
    setColDefs([
      { field: 'order_creation_tmstmp', headerName: 'Created on' },
      { field: 'trading_env', hide: true, headerName: 'Environment' },
      { field: 'broker_id', headerName: 'Broker' },
      { field: 'asset_id', headerName: 'Pair' },
      {
        field: 'order_side',
        headerName: 'Side',
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
      { field: 'trading_type', hide: true, headerName: 'Type' },
      {
        field: 'order_status',
        headerName: 'Status',
        cellRenderer: OrderStatusChip,
      },
      {
        field: 'fill_pct',
        headerName: 'Fill %',
        cellRenderer: LinearProgressWithLabel,
      },
      { field: 'order_volume', headerName: 'Size' },
      { field: 'order_price', headerName: 'Price' },
      {
        headerName: '',
        field: 'order_id',
        cellRenderer: CustomizedMenus,
        colId: 'params',
        cellClass: 'actions-button-cell',
        cellStyle: (params) => {
          return { textAlign: 'center' }
        },
      },
    ])
    setDefaultGridSettings()
  }, [orders, pair, filterState.selectedOrder])


  const displayChartForSelectedOrder = (order: Order) => {
    if (order) {
      let newOrder = ['', '', '']
      if (order.order_id !== filterState.selectedOrder[2]) {
        newOrder = [
          order.order_creation_tmstmp,
          order.order_price.toString(),
          order.order_id,
        ]
        if (pair !== order['asset_id']) {
          dispatch(filterSlice.actions.setPair(order.asset_id))
        }
        if (exchange !== order['broker_id']) {
          dispatch(filterSlice.actions.setExchange(order.broker_id))
        }
      }
      dispatch(filterSlice.actions.setSelectedOrder(newOrder))
    }
  }

  async function cancelOrder(orderDimKey: string) {
    const endpoint = 'http://127.0.0.1:8000/cancel_order/'
    const payload = { order_dim_key: orderDimKey }
    await axios.post(endpoint, payload)
    setSnackIsOpen(true)
    dispatch(filterSlice.actions.setOrdersNeedReload(true))
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

  return (
    <div>
      {orders.length === 0 ? (
        <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
      ) : (
        <div
          className={'ag-theme-quartz-dark'}
          style={{
            width: '100%',
            height: '180px',
            overflow: 'visible !important',
          }}
        >
          <AgGridReact
            ref={gridRef}
            rowData={orders}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            sideBar={sideBar}
            context={{
              displayChartForSelectedOrder,
              cancelOrder,
            }}
            reactiveCustomComponents
            onGridReady={onGridReady}
            rowSelection={'single'}
          />
        </div>
      )}
      <Snackbar
        open={snackIsOpen}
        autoHideDuration={2000}
        onClose={() => {
          setSnackIsOpen(false)
        }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Order cancelled!
        </Alert>
      </Snackbar>
    </div>
  )
}

function Orders(data: { tradingData: tradingDataDef }) {
  return <OrderTable orders={data.tradingData.orders} />
}

export default Orders
