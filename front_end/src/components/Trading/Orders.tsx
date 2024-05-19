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
  styled,
} from '@mui/material'
import Divider from '@mui/material/Divider'
import {
  ColDef,
  GetContextMenuItemsParams,
  GridReadyEvent,
  MenuItemDef,
} from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import 'ag-grid-enterprise'
import { AgGridReact, CustomCellRendererProps } from 'ag-grid-react'
import axios from 'axios'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import '../../css/charts.css'
import { renderCellWithImage } from '../../utils/agGrid'
import { getPairLogo } from '../../utils/common'
import { HOST, PORT, type Order, type tradingDataDef } from '../DataManagement'
import { filterSlice, type FilterState } from '../StateManagement'

interface TableProps {
  data: tradingDataDef
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
          <CandlestickChartOutlinedIcon />
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
  } else if (orderStatus == 'closed') {
    return (
      <Chip
        label={orderStatus}
        color="success"
        variant="outlined"
        size="small"
      />
    )
  } else if (orderStatus == 'canceled') {
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

function OrderTable({ data }: TableProps) {
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

  function applyFilters(filterTyoe: string) {
    if (gridRef!.current!.api) {
      let orderSideFilters: string[] = ['buy', 'sell']
      gridRef!.current!.api.setFilterModel(null)
      switch (filterTyoe) {
        case 'openBuys':
          orderSideFilters = ['buy']
          break
        case 'openSells':
          orderSideFilters = ['sell']
          break
      }
      gridRef
        .current!.api.setColumnFilterModel('order_status', {
          values: ['open'],
        })
        .then(() => {
          gridRef.current!.api.onFilterChanged()
        })
      gridRef.current!.api.onFilterChanged()
      gridRef
        .current!.api.setColumnFilterModel('order_side', {
          values: orderSideFilters,
        })
        .then(() => {
          gridRef.current!.api.onFilterChanged()
        })
    }
  }

  function clearAllFilters(event: any) {
    if (event.api) {
      event.api.setFilterModel(null)
    }
  }

  const getContextMenuItems = useCallback(
    (params: GetContextMenuItemsParams): (string | MenuItemDef)[] => {
      var result: (string | MenuItemDef)[] = [
        {
          name: 'Open Orders',
          action: () => applyFilters(''),
          icon: '<img width="20" height="20" src="https://img.icons8.com/ultraviolet/40/open-sign.png" alt="open-sign"/>',
        },
        {
          name: 'Open Buys',
          action: () => applyFilters('openBuys'),
          icon: '<img width="20" height="20" src="https://img.icons8.com/ultraviolet/20/buy--v1.png" alt="buy--v1"/>',
        },
        {
          name: 'Open Sells',
          action: () => applyFilters('openSells'),
          icon: '<img width="20" height="20" src="https://img.icons8.com/ultraviolet/40/sell.png" alt="sell"/>',
        },
        {
          name: 'Remove Filters',
          action: (e) => clearAllFilters(e),
          icon: '<img width="20" height="20" src="https://static-00.iconduck.com/assets.00/filter-remove-icon-512x440-0mp279cb.png" alt="remove-filters"/>',
        },
        'separator',
        'copy',
        'resetColumns',
        'csvExport',
        'separator',
        'chartRange',
      ]
      return result
    },
    [],
  )

  function setDefaultGridSettings() {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.applyColumnState({
        state: [{ colId: 'order_creation_tmstmp', sort: 'desc' }],
        defaultState: { sort: null },
      })
      gridRef
        .current!.api.setColumnFilterModel('asset_id', {
          values: [pair, pair.replace('-', '/'), pair.replace('/', '-')],
        })
        .then(() => {
          gridRef
            .current!.api.setColumnFilterModel('order_status', {
              values: ['open', 'executed'],
            })
            .then(() => gridRef.current!.api.onFilterChanged())
        })
    }
  }

  useEffect(() => {
    setColDefs([
      { field: 'order_creation_tmstmp', headerName: 'Created on' },
      { field: 'trading_env', hide: true, headerName: 'Environment' },
      {
        field: 'broker_id',
        headerName: 'Broker',
        cellRenderer: (params: { value: string }) => {
          return renderCellWithImage(
            params.value,
            params.value === 'coinbase'
              ? 'https://seeklogo.com/images/C/coinbase-coin-logo-C86F46D7B8-seeklogo.com.png'
              : 'https://logos-world.net/wp-content/uploads/2021/02/Kraken-Logo.png',
          )
          // TODO: replace above once coinmarketcap api is back
        },
      },
      {
        field: 'asset_id',
        headerName: 'Pair',
        cellRenderer: (params: { value: string }) => {
          return renderCellWithImage(
            params.value,
            getPairLogo(data, params.value),
          )
        },
      },
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
      { field: 'usd_value', headerName: '$ Value' },
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
  }, [data.orders, pair, filterState.selectedOrder, data.coinMarketCapMapping])

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
    const endpoint = `http://${HOST}:${PORT}/cancel_order/`
    const payload = { order_dim_key: orderDimKey }
    await axios.post(endpoint, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
      },
    })
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

  const popupParent = useMemo<HTMLElement | null>(() => {
    return document.querySelector('body')
  }, [])

  return (
    <div>
      {data.orders.length === 0 ? (
        <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
      ) : (
        <div
          className={'ag-theme-quartz-dark'}
          style={{
            width: '100%',
            height: '210px',
            overflow: 'visible !important',
          }}
        >
          <AgGridReact
            ref={gridRef}
            rowData={data.orders}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            context={{
              displayChartForSelectedOrder,
              cancelOrder,
            }}
            reactiveCustomComponents
            allowContextMenuWithControlKey={true}
            onGridReady={onGridReady}
            rowSelection={'single'}
            getContextMenuItems={getContextMenuItems}
            popupParent={popupParent}
            suppressCopyRowsToClipboard={true}
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
  return <OrderTable data={data.tradingData} />
}

export default Orders
