import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { type FilterState, filterSlice } from './StateManagement'
import React from 'react'

export interface tradingDataDef {
  coinMarketCapMapping: any
  cryptoMetaData: any
  exchanges: any
  markets: any
  news: NewsArticle[]
  orders: Order[]
  trades: Trade[]
  screeningData: any
  noDataAnimation: any
  ohlcvData: OhlcData
  orderBookData: any
  greedAndFearData: any
}

export type OhlcData = number[][]

export type OrderBookData = Record<string, Array<[number, number]>>

export interface NewsArticle {
  date: string
  title: string
  media: string
  img: string
  link: string
  datetime: string
}

export interface Order {
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

export interface Trade {
  user_id: string
  trade_id: string
  order_id: string
  broker_id: string
  trading_env: string
  trading_type: string
  asset_id: string
  trade_side: string
  execution_tmstmp: string
  trade_volume: number
  trade_price: number
}

export function retrieveInfoFromCoinMarketCap(
  pair: string,
  coinMarketCapMapping: any,
): any {
  const base = pair.slice(0, pair.search('/'))
  let assetInfo
  if (Object.keys(coinMarketCapMapping).length > 0) {
    coinMarketCapMapping.data.forEach((element: any) => {
      if (element.symbol === base) {
        assetInfo = element
      }
    })
  }
  return assetInfo
}

function LoadStaticData(endpoint: string) {
  const [data, setData] = useState<any>([])
  useEffect(() => {
    async function getData() {
      try {
        const url = `http://127.0.0.1:8000/${endpoint}/`
        const response = await fetch(url)
        const responseData = await response.json()
        setData(responseData)
      } catch (error) {
        console.error(`Error fetching ${endpoint} endpoint`, error)
      }
    }
    getData()
  }, [endpoint])
  return data
}

function LoadCryptoMetaData(coinMarketCapMapping: any) {
  const pair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )
  const [metaData, setMetaData] = useState<any>([])
  const coinMarketCapInfo = retrieveInfoFromCoinMarketCap(
    pair,
    coinMarketCapMapping,
  )
  useEffect(() => {
    async function getData() {
      try {
        const url = `http://127.0.0.1:8000/coinmarketcap_crypto_meta/?crypto_coinmarketcap_id=${coinMarketCapInfo.id}`
        const response = await fetch(url)
        const responseData = await response.json()
        setMetaData(responseData)
      } catch (error) {
        console.error('Error fetching Crypto Meta Data endpoint', error)
      }
    }
    coinMarketCapInfo !== undefined && getData()
  }, [coinMarketCapInfo, pair])
  return metaData
}

function LoadMarkets() {
  const [data, setData] = useState<any>({})
  const exchange = useSelector(
    (state: { filters: FilterState }) => state.filters.exchange,
  )
  useEffect(() => {
    async function getMarkets() {
      try {
        setData([])
        const url = `http://127.0.0.1:8000/markets/?exchange=${exchange}`
        const response = await fetch(url)
        const responseData = await response.json()
        setData(responseData)
      } catch (error) {
        console.error('Error fetching markets endpoint', error)
      }
    }
    getMarkets()
  }, [exchange])
  return data
}

function LoadOrders() {
  const dispatch = useDispatch()
  const [orders, setOrders] = useState<Order[]>([])
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )

  const [pair, ordersNeedReload] = useMemo(
    () => [filterState.pair, filterState.ordersNeedReload],
    [filterState.pair, filterState.ordersNeedReload],
  )
  useEffect(() => {
    async function fetchOrders() {
      const ordersEndPoint = 'http://127.0.0.1:8000/orders/?format=json'
      try {
        const response = await fetch(ordersEndPoint)
        setOrders(await response.json())
        dispatch(filterSlice.actions.setOrdersNeedReload(false))
      } catch (error) {
        console.error('Error fetching orders data:', error)
      }
    }
    fetchOrders()
  }, [dispatch, pair, ordersNeedReload])
  return orders
}

function LoadTrades() {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    async function fetchTrades() {
      const ordersEndPoint = 'http://127.0.0.1:8000/trades/?format=json'
      try {
        const response = await fetch(ordersEndPoint)
        setTrades(await response.json())
      } catch (error) {
        console.error('Error fetching trades data:', error)
      }
    }
    fetchTrades()
  }, [])
  return trades
}

function LoadNews(coinMarketCapMapping: any) {
  const pair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )
  const [news, setNewsData] = useState<NewsArticle[]>([])
  useEffect(() => {
    async function getNewsData() {
      setNewsData([])
      const cryptoInfo = retrieveInfoFromCoinMarketCap(
        pair,
        coinMarketCapMapping,
      )
      try {
        if (cryptoInfo !== undefined) {
          const searchTerm = `${cryptoInfo.name} crypto`
          const response = await fetch(
            `http://127.0.0.1:8000/news/?search_term=${searchTerm}`,
          )
          const data = await response.json()
          setNewsData(data)
        }
      } catch (error) {
        setNewsData([])
        console.error('Error fetching news:', error)
      }
    }
    getNewsData()
  }, [coinMarketCapMapping, pair])

  return news
}

function LoadScreeningData() {
  const dispatch = useDispatch()
  const selectedPair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )
  const [screeningData, setScreeningData] = useState<any>([])
  useEffect(() => {
    const wsUrl = 'ws://localhost:8795'
    const socket = new WebSocket(wsUrl)
    socket.onerror = () => {
      console.error('Error with screening service')
    }
    socket.onopen = () => {
      console.log('Connected to screening service')
    }
    socket.onmessage = (event) => {
      const formattedData = JSON.parse(event.data)
      setScreeningData(formattedData)
      formattedData.forEach((pairDetails: any) => {
        if (pairDetails.pair === selectedPair) {
          dispatch(filterSlice.actions.setPairScoreDetails(pairDetails))
        }
      })
    }
    return () => {
      socket.close()
    }
  }, [dispatch, selectedPair])
  return screeningData
}

function LoadNoDataAnimation() {
  const [animationData, setAnimationData] = useState(null)
  useEffect(() => {
    async function fetchAnimationData() {
      const animationUrl =
        'https://lottie.host/010ee17d-3884-424d-b64b-c38ed7236758/wy6OPJZDbJ.json'
      try {
        const response = await fetch(animationUrl)
        setAnimationData(await response.json())
      } catch (error) {
        console.error('Error fetching animation data:', error)
      }
    }
    fetchAnimationData()
  }, [])
  return animationData
}

function LoadOhlcvData() {
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )

  const [exchange, pair, ohlcPeriod] = useMemo(
    () => [filterState.exchange, filterState.pair, filterState.ohlcPeriod],
    [filterState.exchange, filterState.pair, filterState.ohlcPeriod],
  )
  const [ohlcData, setOHLCData] = useState<OhlcData>([])
  useEffect(() => {
    async function fetchOHLCData() {
      try {
        const ohlc_response = await fetch(
          `http://127.0.0.1:8000/ohlc/?exchange=${exchange}&pair=${pair}&timeframe=${ohlcPeriod}`,
        )
        setOHLCData(await ohlc_response.json())
      } catch (error) {
        setOHLCData([])
        console.error('Error fetching OHLC data:', error)
      }
    }
    const ohlcInterval = setInterval(() => {
      fetchOHLCData()
    }, 60000)
    fetchOHLCData()
    return () => {
      clearInterval(ohlcInterval)
    }
  }, [exchange, ohlcPeriod, pair])
  return ohlcData
}

function formatOrderBook(rawOrderBook: any, isWebSocketFeed: boolean) {
  const formattedBook: OrderBookData = { bid: [], ask: [] }
  ;['bid', 'ask'].forEach((side: string) => {
    let cumulativeVolume = 0
    if (isWebSocketFeed) {
      const sortedPrices =
        side === 'bid'
          ? Object.keys(rawOrderBook[side]).sort(
              (a, b) => parseFloat(b) - parseFloat(a),
            )
          : Object.keys(rawOrderBook[side]).sort(
              (a, b) => parseFloat(a) - parseFloat(b),
            )
      formattedBook[side].push([0, parseFloat(sortedPrices[0])])
      sortedPrices.forEach((price: string) => {
        cumulativeVolume += rawOrderBook[side][price]
        formattedBook[side].push([cumulativeVolume, parseFloat(price)])
      })
    } else {
      formattedBook[side].push([0, rawOrderBook[side + 's'][0][0]])
      rawOrderBook[side + 's'].forEach((level: [number, number, number]) => {
        cumulativeVolume += level[1]
        formattedBook[side].push([cumulativeVolume, level[0]])
      })
    }
  })
  return formattedBook
}

function LoadOrderBook(throtle: number = 500) {
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )

  const [exchange, pair] = useMemo(
    () => [filterState.exchange, filterState.pair],
    [filterState.exchange, filterState.pair],
  )
  const [orderBookData, setOrderBookData] = useState<OrderBookData>({})
  let lastRefreshTmtstmp = Date.now()

  useEffect(() => {
    async function fetchOrderBookData() {
      try {
        const orderBookResponse = await fetch(
          `http://127.0.0.1:8000/order_book/?exchange=${exchange}&pair=${pair}`,
        )
        const responseData = await orderBookResponse.json()
        setOrderBookData(formatOrderBook(responseData, false))
      } catch (error) {
        setOrderBookData({})
        console.error('Error fetching Order Book data:', error)
      }
    }

    const wsUrl = `ws://localhost:8768?exchange=${exchange}?book=${pair.replace('/', '-')}`
    const socket = new WebSocket(wsUrl)

    socket.onerror = () => {
      console.warn(
        `Could not implement websocket connection for ${pair} on ${exchange}. Will default back to periodic API refresh.`,
      )
      fetchOrderBookData()
    }
    socket.onopen = () => {
      clearInterval(orderBookInterval)
    }
    socket.onmessage = (event) => {
      if (event.data != 'heartbeat') {
        if (Date.now() - lastRefreshTmtstmp > throtle) {
          lastRefreshTmtstmp = Date.now()
          const newData = JSON.parse(event.data)
          if (Object.keys(newData).includes('book')) {
            setOrderBookData(formatOrderBook(newData.book.book, true))
          }
        }
      }
    }

    const orderBookInterval = setInterval(() => {
      fetchOrderBookData()
    }, 5000)
    fetchOrderBookData()
    return () => {
      socket.close()
      clearInterval(orderBookInterval)
    }
  }, [exchange, pair])
  return orderBookData
}

function LoadGreedAndFear() {
  const [data, setData] = useState<any>({})
  useEffect(() => {
    async function fetchIndexData() {
      const url = 'https://api.alternative.me/fng/'
      try {
        const response = await fetch(url)
        setData(await response.json())
      } catch (error) {
        console.error('Error fetching greed and fear index data:', error)
      }
    }
    fetchIndexData()
  }, [])
  return data
}

export function GetTradingData() {
  const coinMarketCapMapping = LoadStaticData('coinmarketcap_info')
  const cryptoMetaData = LoadCryptoMetaData(coinMarketCapMapping)
  const exchanges = LoadStaticData('exchanges')
  const markets = LoadMarkets()
  const news = LoadNews(coinMarketCapMapping)
  const orders = LoadOrders()
  const trades = LoadTrades()
  const screeningData = LoadScreeningData()
  const noDataAnimation = LoadNoDataAnimation()
  const ohlcvData = LoadOhlcvData()
  const orderBookData = LoadOrderBook()
  const greedAndFearData = LoadGreedAndFear()

  return {
    coinMarketCapMapping,
    cryptoMetaData,
    exchanges,
    markets,
    news,
    orders,
    trades,
    screeningData,
    noDataAnimation,
    ohlcvData,
    orderBookData,
    greedAndFearData,
  }
}
