import { useSelector } from 'react-redux';
import { AnyAction, configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';


export type FilterState = {
    tradingType: string;
    exchange: string;
    pair: string
    selectedArticle: [string, string]
};

const initialState: FilterState = {
    tradingType: 'Paper Trading',
    exchange: 'kraken',
    pair: 'BTC/USD',
    selectedArticle: ['', '']
};

export const filterSlice = createSlice({
    name: 'filters',
    initialState,
    reducers: {
        setTradingType: (state, action) => {
            state.tradingType = action.payload;
        },
        setExchange: (state, action) => {
            state.exchange = action.payload;
        },
        setPair: (state, action) => {
            state.pair = action.payload;
        },
        setSelectedArticle: (state, action) => {
            state.selectedArticle = action.payload;
        },
    },
});


export const filtersStore = configureStore({
    reducer: {
        filters: filterSlice.reducer,
    },
});