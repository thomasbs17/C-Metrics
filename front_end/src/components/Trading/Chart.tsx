import FullscreenIcon from '@mui/icons-material/Fullscreen'
import { ThemeProvider, Tooltip, createTheme } from '@mui/material'
import { deepPurple } from '@mui/material/colors'
import { styled } from '@mui/material/styles'
import { useEffect, useMemo, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { FullScreen, useFullScreenHandle } from 'react-full-screen'
import { useSelector } from 'react-redux'
import {
  retrieveInfoFromCoinMarketCap,
  tradingDataDef,
} from '../DataManagement'
import { FilterState } from '../StateManagement'
import { OhlcvChart } from './Charts/Ohlcv'
import { OrderBookChart } from './Charts/OrderBook'
import { CHART_HEIGHT } from './Charts/common'
import { PairSelectionWidget } from './Header'

const customTheme = createTheme({
  palette: {
    primary: {
      main: deepPurple[500],
    },
  },
})

const StyledIcon = styled(FullscreenIcon)`
  ${({ theme }) => `
  cursor: pointer;
  margin-top: -15px;
  background-color: transparent;
  transition: ${theme.transitions.create(['background-color', 'transform'], {
    duration: theme.transitions.duration.standard,
  })};
  &:hover {
    transform: scale(1.3);
  }
  `}
`

function StyledFullScreenIcon(toggle: any) {
  return (
    <ThemeProvider theme={customTheme}>
      <Tooltip title="Full Screen" placement="left">
        <StyledIcon onClick={toggle.toggle} />
      </Tooltip>
    </ThemeProvider>
  )
}

export function TradingChart(data: { tradingData: tradingDataDef }) {
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )
  const handle = useFullScreenHandle()

  const [exchange, pair, selectedOrder, pairScoreDetails, selectedArticle] =
    useMemo(
      () => [
        filterState.exchange,
        filterState.pair,
        filterState.selectedOrder,
        filterState.pairScoreDetails,
        filterState.selectedArticle,
      ],
      [
        filterState.exchange,
        filterState.pair,
        filterState.selectedOrder,
        filterState.pairScoreDetails,
        filterState.selectedArticle,
      ],
    )

  const [cryptoInfo, setCryptoInfo] = useState<any>({})
  const [cryptoMetaData, setCryptoMetaData] = useState<any>({})

  const headerDivStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    position: 'absolute',
    width: '75%',
    height: 0,
    marginTop: '-1%',
    marginLeft: '3%',
    zIndex: 4,
  }

  const defaultScreenDivStyle: React.CSSProperties = {
    height: CHART_HEIGHT,
    overflow: 'hidden',
  }

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
    <div style={defaultScreenDivStyle}>
      <div style={headerDivStyle}>
        <PairSelectionWidget tradingData={data.tradingData} />
        <StyledFullScreenIcon toggle={handle.enter} />
      </div>
      <FullScreen handle={handle}>
        <Row>
          <Col sm={10} style={{ height: '100%' }}>
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
                  key={`${pair}BookChart`}
                />
              )}
          </Col>
        </Row>
      </FullScreen>
    </div>
  )
}
