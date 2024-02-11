import { CircularProgress } from '@mui/material'
import { ColDef, RowClickedEvent, SideBarDef } from 'ag-grid-community'
import 'ag-grid-enterprise'
import { AgGridReact } from 'ag-grid-react'
import { useEffect, useMemo, useState } from 'react'
import { Container } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import { type Order, type tradingDataDef } from '../DataManagement'
import { filterSlice, type FilterState } from '../StateManagement'

interface TableProps {
  orders: Order[]
}

function formatTimeStamp(originalDate: any) {
  let formattedDate = originalDate.substring(0, 19)
  formattedDate = formattedDate.replace('T', ' ')
  return formattedDate
}

function OrderTable({ orders }: TableProps) {
  const dispatch = useDispatch()
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )
  const [pair, selectedOrder] = useMemo(
    () => [filterState.pair, filterState.selectedOrder],
    [filterState.pair, filterState.selectedOrder],
  )

  const [colDefs, setColDefs] = useState<ColDef<Order>[]>([])

  useEffect(() => {
    setColDefs([
      { field: 'order_creation_tmstmp' },
      { field: 'trading_env', hide: true },
      { field: 'asset_id' },
      { field: 'order_side' },
      { field: 'trading_type', hide: true },
      { field: 'order_status' },
      { field: 'fill_pct' },
      { field: 'order_volume' },
      { field: 'order_price' },
    ])
  }, [orders])

  const handleClick = (holding: RowClickedEvent<Order, any>) => {
    if (holding.rowIndex || holding.rowIndex === 0) {
      const order = orders[holding.rowIndex]
      if (order.order_id !== selectedOrder[2]) {
        dispatch(
          filterSlice.actions.setSelectedOrder([
            order.order_creation_tmstmp,
            order.order_price,
            order.order_id,
          ]),
        )
        if (pair !== order['asset_id']) {
          dispatch(filterSlice.actions.setPair(order.asset_id))
        }
      } else {
        dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
      }
    }
  }

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
    }
  }, [])

  return orders.length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <div
      className={'ag-theme-quartz-dark'}
      style={{ width: '100%', height: '180px' }}
    >
      <AgGridReact
        rowData={orders}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        // autoGroupColumnDef={autoGroupColumnDef}
        sideBar={sideBar}
        onRowClicked={(r) => handleClick(r)}
      />
    </div>
  )
}

function Orders(data: { tradingData: tradingDataDef }) {
  return (
    <Container>
      <OrderTable orders={data.tradingData.orders} />
    </Container>
  )
}

export default Orders
