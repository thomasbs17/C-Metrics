import { CircularProgress } from '@mui/material'
import Lottie from 'lottie-react'
import { useEffect, useMemo, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useSelector } from 'react-redux'
import {
  retrieveInfoFromCoinMarketCap,
  type tradingDataDef,
} from '../DataManagement'
import { type FilterState } from '../StateManagement'
import { OhlcChart } from './Charts/Ohlcv'
import { OrderBookChart } from './Charts/OrderBook'
import { CHART_HEIGHT } from './Charts/common'
import { OhlcPeriodsFilter, PairSelectionWidget } from './Header'

export function TradingChart(data: { tradingData: tradingDataDef }) {
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )

  const [
    exchange,
    pair,
    selectedOrder,
    pairScoreDetails,
    selectedArticle,
    loadingComponents,
  ] = useMemo(
    () => [
      filterState.exchange,
      filterState.pair,
      filterState.selectedOrder,
      filterState.pairScoreDetails,
      filterState.selectedArticle,
      filterState.loadingComponents,
    ],
    [
      filterState.exchange,
      filterState.pair,
      filterState.selectedOrder,
      filterState.pairScoreDetails,
      filterState.selectedArticle,
      filterState.loadingComponents,
    ],
  )

  const [cryptoInfo, setCryptoInfo] = useState<any>({})
  const [cryptoMetaData, setCryptoMetaData] = useState<any>({})
  const [volumeArray, setVolumeArray] = useState<number[][]>([])

  useEffect(() => {
    setCryptoInfo(
      retrieveInfoFromCoinMarketCap(
        pair,
        data.tradingData.coinMarketCapMapping,
      ),
    )
    if (
      cryptoInfo &&
      Object.keys(cryptoInfo).length !== 0 &&
      data.tradingData.cryptoMetaData.length !== 0
    ) {
      setCryptoMetaData(data.tradingData.cryptoMetaData.data[cryptoInfo.id])
    }
  }, [
    pair,
    data.tradingData.coinMarketCapMapping,
    data.tradingData.cryptoMetaData,
    cryptoInfo,
  ])

  let decimalPlaces = 2
  try {
    decimalPlaces = data.tradingData.markets[pair].precision.price
      .toString()
      .split('.')[1].length
  } catch {}

  return (
    <div style={{ height: CHART_HEIGHT }}>
      <Row style={{ height: CHART_HEIGHT }}>
        <Col sm={10}>
          <Row style={{ zIndex: 2, position: 'absolute', marginLeft: '50px' }}>
            <Col style={{ width: '50%' }}>
              <PairSelectionWidget tradingData={data.tradingData} />
            </Col>
            <Col style={{ marginTop: '7%' }}>
              <OhlcPeriodsFilter />
            </Col>
          </Row>
          {loadingComponents['ohlcv'] && (
            <CircularProgress
              style={{ position: 'absolute', top: '30%', left: '40%' }}
            />
          )}
          {data.tradingData.ohlcvData[pair] === null &&
          !loadingComponents['ohlcv'] ? (
            <Lottie
              animationData={data.tradingData.noDataAnimation}
              style={{ height: CHART_HEIGHT }}
            />
          ) : (
            <OhlcChart
              data={data.tradingData}
              exchange={exchange}
              pair={pair}
              selectedArticle={selectedArticle}
              selectedOrder={selectedOrder}
              pairScoreDetails={pairScoreDetails}
              cryptoInfo={cryptoInfo}
              cryptoMetaData={cryptoMetaData}
              decimalPlaces={decimalPlaces}
            />
          )}
        </Col>
        <Col sm={2} style={{ zIndex: 2 }}>
          {Object.keys(data.tradingData.orderBookData).includes('bid') &&
            data.tradingData.orderBookData.bid.length !== 0 && (
              <OrderBookChart
                data={data.tradingData.orderBookData}
                pair={pair}
                selectedOrder={selectedOrder}
                pairScoreDetails={pairScoreDetails}
              />
            )}
        </Col>
      </Row>
    </div>
  )
}
