import React from 'react';
import { AnyAction, createStore } from 'redux';


export type FilterState = {
    tradingType: string;
    exchange: string;
    currency: string;
    asset: string;
};

export const initialState: FilterState = {
    tradingType: 'Paper Trading',
    exchange: 'coinbasepro',
    currency: 'USD',
    asset: 'BTC',
};

const filterReducer = (state: FilterState = initialState, action: AnyAction): FilterState => {
    switch (action.type) {
        case 'SET_TRADING_TYPE':
            return { ...state, tradingType: action.payload };
        case 'SET_EXCHANGE':
            return { ...state, exchange: action.payload };
        case 'SET_CURRENCY':
            return { ...state, currency: action.payload };
        case 'SET_ASSET':
            return { ...state, asset: action.payload };
        default:
            return state;
    }
};


export const filtersStore = createStore(filterReducer);