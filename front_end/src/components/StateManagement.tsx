import { configureStore, createSlice } from '@reduxjs/toolkit'

export type Order = {
  user_id: string
  order_id: string
  broker_id: string
  trading_env: string
  trading_type: string
  asset_id: string
  order_side: string
  order_type: string
  order_creation_tmstmp: string
  order_status: string
  fill_pct: number
  order_volume: number
  order_price: number
}

export type FilterState = {
  tradingType: string
  exchange: string
  pair: string
  selectedArticle: [string, string]
  selectedOrder: [string, string, string]
  ordersNeedReload: boolean
  pairScoreDetails: any
}

const initialState: FilterState = {
  tradingType: 'Paper Trading',
  exchange: 'kraken',
  pair: '1INCH/EUR',
  selectedArticle: ['', ''],
  selectedOrder: ['', '', ''],
  ordersNeedReload: true,
  pairScoreDetails: {},
}

export const filterSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setTradingType: (state, action) => {
      state.tradingType = action.payload
    },
    setExchange: (state, action) => {
      state.exchange = action.payload
    },
    setPair: (state, action) => {
      state.pair = action.payload
    },
    setSelectedArticle: (state, action) => {
      state.selectedArticle = action.payload
    },
    setSelectedOrder: (state, action) => {
      state.selectedOrder = action.payload
    },
    setOrdersNeedReload: (state, action) => {
      state.ordersNeedReload = action.payload
    },
    setPairScoreDetails: (state, action) => {
      state.pairScoreDetails = action.payload
    },
  },
})

export const filtersStore = configureStore({
  reducer: {
    filters: filterSlice.reducer,
  },
})
