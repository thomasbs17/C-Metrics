import { configureStore, createSlice } from '@reduxjs/toolkit'
import React from 'react'

export interface FilterState {
  tradingType: string
  ohlcPeriod: string
  exchange: string
  pair: string
  selectedArticle: [string, string]
  selectedOrder: [string, string, string]
  ordersNeedReload: boolean
  pairScoreDetails: any
  loadingComponents: { [key: string]: boolean }
}

const initialState: FilterState = {
  tradingType: 'Paper Trading',
  ohlcPeriod: '1d',
  exchange: 'coinbase',
  pair: 'BTC/USD',
  selectedArticle: ['', ''],
  selectedOrder: ['', '', ''],
  ordersNeedReload: true,
  pairScoreDetails: {},
  loadingComponents: { ohlcv: true, book: true },
}

export const filterSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setTradingType: (state, action) => {
      state.tradingType = action.payload
    },
    setOhlcPeriod: (state, action) => {
      state.ohlcPeriod = action.payload
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
    setLoadingComponents: (state, action) => {
      state.loadingComponents[action.payload[0]] = action.payload[1]
    },
  },
})

export const filtersStore = configureStore({
  reducer: {
    filters: filterSlice.reducer,
  },
})
