import { Button, ButtonGroup, CircularProgress } from '@mui/material'
import HighchartsReact, {
  HighchartsReactRefObject,
} from 'highcharts-react-official'
import Highcharts from 'highcharts/highstock'
import IndicatorsAll from 'highcharts/indicators/indicators-all'
import Indicators from 'highcharts/indicators/indicators-all.js'
import VBP from 'highcharts/indicators/volume-by-price'
import AnnotationsAdvanced from 'highcharts/modules/annotations-advanced.js'
import HighchartsBoost from 'highcharts/modules/boost'
import FullScreen from 'highcharts/modules/full-screen.js'
import PriceIndicator from 'highcharts/modules/price-indicator.js'
import StockTools from 'highcharts/modules/stock-tools'
import Lottie from 'lottie-react'
import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import '../../../css/charts.css'
import { OhlcData, tradingDataDef } from '../../DataManagement'
import { FilterState } from '../../StateManagement'
import { OhlcPeriodsFilter } from '../Header'
import { CHART_HEIGHT } from './common'

// HighchartsAccessibility(Highcharts)
IndicatorsAll(Highcharts)
HighchartsBoost(Highcharts)
StockTools(Highcharts)
VBP(Highcharts)
Indicators(Highcharts)
AnnotationsAdvanced(Highcharts)
PriceIndicator(Highcharts)
FullScreen(Highcharts)

interface OhlcChartProps {
  data: tradingDataDef
  exchange: string
  pair: string
  selectedArticle: [string, string]
  selectedOrder: [string, string, string]
  pairScoreDetails: any
  cryptoInfo: any
  cryptoMetaData: any
  decimalPlaces: number
}

interface TradingViewProps {
  exchange: string
  pair: string
}

export function CryptoStationOhlcChart(props: OhlcChartProps) {
  const ohlcvChartRef = useRef<HighchartsReactRefObject>(null)
  const [chartOptions] = useState<any>({
    plotOptions: {
      series: {
        marker: {
          enabled: false,
        },
      },
      ohlc: {
        color: 'red',
        upColor: 'green',
      },
    },
    xAxis: [
      {
        type: 'datetime',
        lineWidth: 0,
        gridLineWidth: 0.05,
        events: {
          afterSetExtremes: afterSetXExtremes,
        },
        crosshair: {
          color: 'gray',
          width: 1,
          snap: false,
          label: {
            enabled: true,
            backgroundColor: 'transparent',
            formatter: function (value: number) {
              return Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', value)
            },
          },
        },
        opposite: false,
      },
    ],
    yAxis: [
      {
        lineWidth: 0,
        minorGridLineWidth: 0,
        lineColor: 'transparent',
        minorTickLength: 0,
        tickLength: 0,
        labels: {
          enabled: false,
        },
        resize: {
          enabled: true,
        },
        title: { text: '' },
        crosshair: {
          color: 'gray',
          dashStyle: 'solid',
          snap: false,
          label: {
            enabled: true,
            backgroundColor: 'transparent',
            formatter: function (value: number) {
              return value.toLocaleString()
            },
          },
        },
        gridLineWidth: 0.05,
        top: '0%',
        height: '90%',
      },
      {
        title: {
          text: '',
        },
        top: '80%',
        height: '10%',
        gridLineWidth: 0,
        crosshair: {
          color: 'gray',
          dashStyle: 'solid',
          snap: false,
          label: {
            enabled: true,
            backgroundColor: 'transparent',
            formatter: function (value: number) {
              return value.toFixed(2)
            },
          },
        },
      },
      {
        top: '90%',
        height: '10%',
      },
    ],
    title: {
      text: props.pair,
      style: {
        color: 'transparent',
      },
    },
    tooltip: {
      shape: 'square',
      headerShape: 'callout',
      borderWidth: 0,
      shadow: false,
      backgroundColor: 'rgba(0,0,0,1)',
      style: { color: 'white' },
      positioner: function (width: number, height: number, point: any) {
        if (ohlcvChartRef.current) {
          const chart = ohlcvChartRef.current.chart
          let position
          if (point.isHeader) {
            position = {
              x: Math.max(
                // Left side limit
                chart.plotLeft,
                Math.min(
                  point.plotX + chart.plotLeft - width / 2,
                  // Right side limit
                  chart.chartWidth - width,
                ),
              ),
              y: point.plotY,
            }
          } else {
            position = {
              x: point.series.chart.plotLeft,
              y: point.series.yAxis.top - chart.plotTop,
            }
          }

          return position
        }
      },
    },
    series: [
      {
        data: [],
        name: props.pair,
        type: 'ohlc',
        yAxis: 0,
        id: 'ohlc',
      },
      {
        data: [],
        name: 'volume',
        type: 'column',
        id: 'volume',
        yAxis: 1,
      },
      {
        yAxis: 2,
        type: 'rsi',
        linkedTo: 'ohlc',
        min: 0,
        max: 100,
      },
      {
        yAxis: 0,
        type: 'bb',
        linkedTo: 'ohlc',
        color: 'purple',
      },
      {
        yAxis: 0,
        type: 'vbp',
        linkedTo: 'ohlc',
        zoneLines: { enabled: false },
        params: { ranges: 30 },
        dataLabels: { enabled: false },
        opacity: 0.5,
      },
    ],
    navigation: {
      annotationsOptions: {
        shapeOptions: {
          stroke: 'blue',
          bindingsClassName: 'ohlcv-chart',
        },
      },
    },
    chart: {
      backgroundColor: 'transparent',
      height: CHART_HEIGHT,
    },
    credits: { enabled: false },
  })

  useEffect(() => {
    const chart = ohlcvChartRef.current!.chart
    const ohlcv = props.data.ohlcvData[props.pair] as OhlcData
    if (chart && ohlcv) {
      const volumeArrayData = ohlcv!.map((item: any) => [item[0], item[5]])
      if (volumeArrayData) {
        chart.series[1].setData(volumeArrayData)
      }
      chart.series[0].setData(ohlcv)
    }
    chart.series.forEach((series: any) => {
      series.update()
    })
  }, [chartOptions, props.pair, props.data.ohlcvData[props.pair]])

  useEffect(() => {
    const chart = ohlcvChartRef.current!.chart
    if (chart) {
      ;(chart.series[0].yAxis as any).plotLinesAndBands.forEach((line: any) => {
        chart.series[0].yAxis.removePlotLine(line['id'])
      })
      const xAxisPlotLinesId = ['selectedArticleDate', 'selectedOrderDate']
      xAxisPlotLinesId.forEach((id: string) =>
        chart.series[0].xAxis.removePlotLine(id),
      )
      chart.series[0].name = props.pair
      chart.series[0].yAxis.addPlotLine({
        color: 'white',
        width: 0.7,
        dashStyle: 'Dot',
        value: parseFloat(props.selectedOrder[1]),
        id: 'selectedOrderPrice',
      })
      chart.series[2].yAxis.addPlotLine({
        color: 'green',
        width: 1,
        dashStyle: 'Dot',
        value: 70,
        id: 'rsiUpper',
      })
      chart.series[2].yAxis.addPlotLine({
        color: 'red',
        width: 1,
        dashStyle: 'Dot',
        value: 30,
        id: 'rsiLower',
      })
      chart.series[2].yAxis.setExtremes(0, 100)
      if (Object.keys(props.pairScoreDetails).length > 0) {
        ;['supports', 'resistances'].forEach((levelType: string, index) => {
          props.pairScoreDetails[levelType].forEach(
            (level: number, levelIndex: number) => {
              chart.series[0].yAxis.addPlotLine({
                color: levelType === 'supports' ? 'red' : 'green',
                width: 0.5 * (1 / (levelIndex + 1)),
                id: `${levelIndex}-${levelType}`,
                value: level,
              })
            },
          )
        })
      }
      chart.series[0].xAxis.addPlotLine({
        color: 'white',
        width: 0.7,
        dashStyle: 'Dot',
        id: 'selectedArticleDate',
        value: new Date(props.selectedArticle[0]).getTime(),
      })
      chart.series[0].xAxis.addPlotLine({
        color: 'white',
        width: 0.7,
        dashStyle: 'Dot',
        id: 'selectedOrderDate',
        value: new Date(props.selectedOrder[0]).getTime(),
      })
    }
  }, [
    props.cryptoInfo,
    props.cryptoMetaData,
    props.pair,
    props.pairScoreDetails,
    props.selectedArticle,
    props.selectedOrder,
  ])

  function afterSetXExtremes(this: any, e: any) {
    // TODO: find better implementation
    // const data = props.data.ohlcvData[props.pair]
    // if (data) {
    //   const latestTimestamp = data![data!.length - 1][0]
    //   this.setExtremes(this.min, latestTimestamp)
    // }
  }

  // useEffect(() => {
  //   const chart = ohlcvChartRef!.current!.chart
  //   if (chart) {
  //     chart.setSize(null, window.innerHeight * 0.8)
  //   }
  // }, [window])

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={chartOptions}
      constructorType={'stockChart'}
      ref={ohlcvChartRef}
    />
  )
}

export function TradingViewWidget(props: TradingViewProps) {
  const container = useRef()
  const [firstRender, setFirstRender] = useState<boolean>(true)

  useEffect(() => {
    setFirstRender(false)
  }, [])

  useEffect(() => {
    const currentContainer = container.current as any
    const htmlChildren = Array.from(currentContainer!.children || [])

    function clearUp() {
      if (htmlChildren && !firstRender) {
        htmlChildren.forEach((child: any) => {
          try {
            currentContainer.removeChild(child)
          } catch {}
        })
      }
    }

    const script = document.createElement('script')
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    const formattedPair = props.pair
      .replace('-', '')
      .replace('/', '')
      .toUpperCase()
    script.innerHTML = `
        {
          "autosize": true,
          "symbol": "${props.exchange.toUpperCase()}:${formattedPair}",
          "interval": "D",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "en",
          "enable_publishing": false,
          "withdateranges": true,
          "hide_side_toolbar": false,
          "save_image": false,
          "calendar": false,
          "studies": [
            "STD;Bollinger_Bands",
            "STD;Willams_R"
          ],
          "show_popup_button": true,
          "popup_width": "1000",
          "popup_height": "650",
          "support_host": "https://www.tradingview.com"
        }`
    if (currentContainer && htmlChildren) {
      clearUp()
      currentContainer.appendChild(script)
    }
    return () => {
      clearUp()
    }
  }, [props.pair, props.exchange])

  return (
    <div style={{ height: '550px' }}>
      <div
        className="tradingview-widget-container"
        ref={container! as any}
        key="tradingViewContainer"
        style={{ height: '100%', width: '100%' }}
      >
        <div
          className="tradingview-widget-container__widget"
          style={{ height: 'calc(100% - 32px)', width: '100%' }}
        ></div>
      </div>
    </div>
  )
}

export function OhlcvChart(props: OhlcChartProps) {
  const [chartType, setChartType] = useState<string>('crypto-station')
  const loadingComponents = useSelector(
    (state: { filters: FilterState }) => state.filters.loadingComponents,
  )
  const formattedPair = props.pair.replace('/', '-')
  const exchangeLink =
    props.exchange === 'coinbase'
      ? `https://www.coinbase.com/advanced-trade/spot/${formattedPair}`
      : `https://pro.kraken.com/app/trade/${formattedPair}`

  return (
    <div style={{ height: 0 }}>
      <div
        style={{
          display: 'flex',
          placeContent: 'flex-end space-evenly',
          flexFlow: 'column-reverse wrap',
          position: 'relative',
          zIndex: 3,
          flexWrap: 'wrap',
          alignContent: 'space-between',
          flexDirection: 'row-reverse',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
        }}
      >
        <Button
          sx={{ fontSize: 10 }}
          variant="outlined"
          component={Link}
          to={exchangeLink}
          target="_blank"
        >
          {`View on ${props.exchange}`}
        </Button>
        <ButtonGroup aria-label="chart-provider-buttons">
          <Button
            sx={{ fontSize: 10 }}
            variant={chartType === 'crypto-station' ? 'contained' : 'text'}
            onClick={() => setChartType('crypto-station')}
          >
            C-Metrics
          </Button>
          <Button
            sx={{ fontSize: 10 }}
            variant={chartType === 'trading-view' ? 'contained' : 'text'}
            onClick={() => setChartType('trading-view')}
          >
            TradingView
          </Button>
        </ButtonGroup>
      </div>
      {chartType === 'trading-view' ? (
        <div style={{ height: '90%' }}>
          <TradingViewWidget exchange={props.exchange} pair={props.pair} />
        </div>
      ) : (
        <div>
          <OhlcPeriodsFilter />
          {loadingComponents['ohlcv'] && (
            <CircularProgress
              style={{ position: 'absolute', top: '30%', left: '40%' }}
            />
          )}
          {props.data.ohlcvData[props.pair] === null &&
          !loadingComponents['ohlcv'] ? (
            <Lottie
              animationData={props.data.noDataAnimation}
              style={{ height: CHART_HEIGHT }}
            />
          ) : (
            <div style={{ marginTop: '-5%' }}>
              <CryptoStationOhlcChart
                data={props.data}
                exchange={props.exchange}
                pair={props.pair}
                selectedArticle={props.selectedArticle}
                selectedOrder={props.selectedOrder}
                pairScoreDetails={props.pairScoreDetails}
                cryptoInfo={props.cryptoInfo}
                cryptoMetaData={props.cryptoMetaData}
                decimalPlaces={props.decimalPlaces}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
