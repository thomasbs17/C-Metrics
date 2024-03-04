import { useEffect, useMemo, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useSelector } from 'react-redux'
import {
  retrieveInfoFromCoinMarketCap,
  type tradingDataDef,
} from '../DataManagement'
import { type FilterState } from '../StateManagement'
import { OhlcvChart } from './Charts/Ohlcv'
import { OrderBookChart } from './Charts/OrderBook'
import { CHART_HEIGHT } from './Charts/common'
import { PairSelectionWidget } from './Header'

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
    <div style={{ height: CHART_HEIGHT, overflow: 'hidden' }}>
      <Row style={{ height: CHART_HEIGHT }}>
        <Col sm={10} style={{ height: '100%' }}>
          <PairSelectionWidget tradingData={data.tradingData} />
          <OhlcvChart
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
