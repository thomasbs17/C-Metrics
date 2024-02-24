import {
  CircularProgress,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material'
import HighchartsReact, {
  type HighchartsReactRefObject,
} from 'highcharts-react-official'
import Highcharts from 'highcharts/highstock'
import IndicatorsAll from 'highcharts/indicators/indicators-all'
import Indicators from 'highcharts/indicators/indicators-all.js'
import VDP from 'highcharts/indicators/volume-by-price'
import AnnotationsAdvanced from 'highcharts/modules/annotations-advanced.js'
import HighchartsBoost from 'highcharts/modules/boost'
import FullScreen from 'highcharts/modules/full-screen.js'
import PriceIndicator from 'highcharts/modules/price-indicator.js'
import StockTools from 'highcharts/modules/stock-tools'
import DarkTheme from 'highcharts/themes/brand-dark'
import Lottie from 'lottie-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useSelector } from 'react-redux'
import {
  retrieveInfoFromCoinMarketCap,
  type OhlcData,
  type OrderBookData,
  type tradingDataDef,
} from '../DataManagement'
import { type FilterState } from '../StateManagement'
import './charts.css'

const CHART_HEIGHT = 600

// exporting(Highcharts);
// exportData(Highcharts);
LinearGauge(Highcharts)
IndicatorsAll(Highcharts)
HighchartsBoost(Highcharts)
// DragPanes(Highcharts);
StockTools(Highcharts)
VDP(Highcharts)
Indicators(Highcharts)
AnnotationsAdvanced(Highcharts)
PriceIndicator(Highcharts)
FullScreen(Highcharts)
DarkTheme(Highcharts)

function LinearGauge(H: any) {
  H.seriesType('lineargauge', 'column', null, {
    setVisible: function () {
      H.seriesTypes.column.prototype.setVisible.apply(this, arguments)
      if (this.markLine) {
        this.markLine[this.visible ? 'show' : 'hide']()
      }
    },
    drawPoints: function () {
      H.seriesTypes.column.prototype.drawPoints.apply(this, arguments)
      const series = this
      const chart = this.chart
      const inverted = chart.inverted
      const xAxis = this.xAxis
      const yAxis = this.yAxis
      const point = this.points[0]
      let markLine = this.markLine
      const ani = markLine ? 'animate' : 'attr'
      point.graphic.hide()

      if (!markLine) {
        const path = inverted
          ? [
              'M',
              0,
              0,
              'L',
              -5,
              -5,
              'L',
              5,
              -5,
              'L',
              0,
              0,
              'L',
              0,
              0 + xAxis.len,
            ]
          : ['M', 0, 0, 'L', -5, -5, 'L', -5, 5, 'L', 0, 0, 'L', xAxis.len, 0]
        markLine = this.markLine = chart.renderer
          .path(path)
          .attr({
            fill: series.color,
            stroke: series.color,
            'stroke-width': 1,
          })
          .add()
      }
      markLine[ani]({
        translateX: inverted
          ? xAxis.left + yAxis.translate(point.y)
          : xAxis.left,
        translateY: inverted
          ? xAxis.top
          : yAxis.top + yAxis.len - yAxis.translate(point.y),
      })
    },
  })
}

interface BookChartProps {
  data: OrderBookData
  pair: string
  selectedOrder: [string, string, string]
  pairScoreDetails: any
}

interface OhlcChartProps {
  data: OhlcData | null
  exchange: string
  pair: string
  selectedArticle: [string, string]
  selectedOrder: [string, string, string]
  pairScoreDetails: any
  volumeArray: number[][]
  cryptoInfo: any
  cryptoMetaData: any
  decimalPlaces: number
}

interface GreedAndFearChartProps {
  data: any
}

function getSpread(bookData: OrderBookData) {
  let spread = 'N/A'
  if (
    Object.keys(bookData).length !== 0 &&
    bookData.bid.length > 0 &&
    bookData.ask.length > 0
  ) {
    spread = ((bookData.ask[0][1] / bookData.bid[0][1] - 1) * 100).toFixed(2)
  }
  return spread
}

function OrderBookChart(props: BookChartProps) {
  const orderBookChartRef = useRef<HighchartsReactRefObject>(null)
  const bidAskFontSize = '13px'
  const spread = getSpread(props.data)
  const bid = props.data.bid[0][1]
  const ask = props.data.ask[0][1]
  const [synchCharts, setSynchCharts] = useState(false)

  const [chartOptions] = useState<any>({
    boost: {
      useGPUTranslations: true,
    },
    tooltip: {
      enabled: false,
    },
    xAxis: [
      {
        minRange: 0,
        visible: false,
        type: 'linear',
        labels: { enabled: false },
        snap: false,
        events: {
          afterSetExtremes,
        },
        tooltip: {
          enabled: false,
        },
      },
    ],
    yAxis: [
      {
        visible: true,
        labels: {
          enabled: false,
        },
        resize: {
          enabled: true,
        },
        title: { text: '' },
        lineWidth: 0,
        gridLineWidth: 0,
        tooltip: {
          enabled: true,
        },
      },
    ],
    title: {
      text: 'order book',
      style: {
        fontSize: 0,
      },
    },
    series: [
      {
        data: [],
        name: 'Bids',
        yAxis: 0,
        color: 'green',
        fillColor: {
          linearGradient: [300, 0, 0, 300],
          stops: [
            [0, 'rgba(0, 150, 0, 1)'],
            [1, 'rgba(0, 0, 0, 0)'],
          ],
        },
        type: 'area',
      },
      {
        data: [],
        name: 'Asks',
        yAxis: 0,
        color: 'red',
        fillColor: {
          linearGradient: [0, 0, 300, 0],
          stops: [
            [0, 'rgba(0, 0, 0, 0)'],
            [1, 'rgba(150, 0, 0, 1'],
          ],
        },
        threshold: Infinity,
        type: 'area',
      },
    ],
    stockTools: {
      gui: {
        buttons: ['fullScreen'],
        toolbarClassName: 'test',
      },
    },
    chart: {
      backgroundColor: 'transparent',
      height: CHART_HEIGHT - 215,
      animation: false,
      zooming: {
        mouseWheel: { enabled: true, type: 'x' },
      },
    },
    legend: {
      enabled: false,
    },
    plotOptions: {
      series: {
        point: {
          events: {
            mouseOver: handleHover,
            mouseOut: handleOut,
          },
        },
      },
    },
    credits: { enabled: false },
  })

  function getOverSidePrice(price: number) {
    const bid = props.data.bid[0][1]
    const ask = props.data.ask[0][1]
    if (price >= ask) {
      const distance = price / ask - 1
      return ['bid', bid - distance * bid]
    } else if (bid >= price) {
      const distance = bid / price - 1
      return ['ask', distance * ask + ask]
    }
  }

  function handleOut() {
    if (orderBookChartRef.current) {
      orderBookChartRef.current.chart.series[0].yAxis.removePlotLine(
        'ask-book-hover-line',
      )
      orderBookChartRef.current.chart.series[0].yAxis.removePlotLine(
        'bid-book-hover-line',
      )
      orderBookChartRef.current.chart.series[0].yAxis.removePlotLine(
        'central-book-hover-line',
      )
    }
  }

  function handleHover(this: any) {
    const overSidePrice = getOverSidePrice(this.y)
    const bid = props.data.bid[0][1]
    const ask = props.data.ask[0][1]
    if (orderBookChartRef.current) {
      handleOut()
      if (overSidePrice !== undefined) {
        const hoverBid = overSidePrice[0] === 'bid' ? overSidePrice[1] : this.y
        const hoverAsk = overSidePrice[0] === 'ask' ? overSidePrice[1] : this.y
        const hoverDistance = (hoverAsk / hoverBid - 1) * 100

        orderBookChartRef.current.chart.series[0].yAxis.addPlotLine({
          color: 'red',
          value: hoverAsk,
          dashStyle: 'Dot',
          label: {
            text: hoverAsk.toLocaleString(),
            style: { color: 'red' },
            align: 'right',
          },
          id: 'ask-book-hover-line',
        })
        orderBookChartRef.current.chart.series[0].yAxis.addPlotLine({
          color: 'green',
          value: hoverBid,
          dashStyle: 'Dot',
          label: {
            text: hoverBid.toLocaleString(),
            style: { color: 'green' },
            align: 'right',
          },
          id: 'bid-book-hover-line',
        })
        orderBookChartRef.current.chart.series[0].yAxis.addPlotLine({
          color: 'white',
          value: (ask + bid) / 2,
          label: {
            text: `${hoverDistance.toFixed(2)}%`,
            style: { color: 'white' },
            align: 'right',
          },
          width: 0,
          id: 'central-book-hover-line',
        })
      }
    }
  }

  function filterData(bookDepthPct: number = 0.95) {
    const bids = props.data.bid
    const asks = props.data.ask
    const filteredBids = bids.slice(0, Math.ceil(bids.length * bookDepthPct))
    const filteredAsks = asks.filter((ask) => ask[1] - asks[0][1] <= bids[0][1])
    return { bids: filteredBids, asks: filteredAsks }
  }

  useEffect(() => {
    const filteredData = filterData()
    if (orderBookChartRef.current && orderBookChartRef.current.chart) {
      orderBookChartRef.current.chart.series[0].setData(filteredData.bids)
      orderBookChartRef.current.chart.series[1].setData(filteredData.asks)
      orderBookChartRef.current.chart.update({
        plotOptions: {
          series: {
            point: {
              events: {
                mouseOver: handleHover,
                mouseOut: handleOut,
              },
            },
          },
        },
      })
    }
  }, [props.data])

  useEffect(() => {
    if (orderBookChartRef.current && orderBookChartRef.current.chart) {
      orderBookChartRef.current.chart.series.forEach((HighchartSeries: any) => {
        HighchartSeries.yAxis.removePlotLine('selectedOrderPrice')
        HighchartSeries.yAxis.removePlotLine('supportLine')
        HighchartSeries.yAxis.removePlotLine('resistanceLine')
        HighchartSeries.yAxis.addPlotLine({
          color: 'white',
          width: 1,
          dashStyle: 'Dot',
          value: props.selectedOrder[1],
          id: 'selectedOrderPrice',
        })
        HighchartSeries.yAxis.addPlotLine({
          color: 'red',
          width: 0.5,
          label: { text: 'support', align: 'right', style: { color: 'red' } },
          id: 'supportLine',
          value:
            props.pairScoreDetails !== undefined &&
            Object.keys(props.pairScoreDetails).includes('next_support')
              ? props.pairScoreDetails.next_support
              : null,
        })
        HighchartSeries.yAxis.addPlotLine({
          color: 'green',
          width: 0.5,
          label: {
            text: 'resistance',
            align: 'right',
            style: { color: 'green' },
          },
          id: 'resistanceLine',
          value:
            props.pairScoreDetails !== undefined &&
            Object.keys(props.pairScoreDetails).includes('next_resistance')
              ? props.pairScoreDetails.next_resistance
              : null,
        })
      })
    }
  }, [props.pairScoreDetails, props.selectedOrder])

  function afterSetExtremes(this: any, e: any) {
    let bookSideDetails = { ask: {}, bid: {} }
    Object.keys(bookSideDetails).forEach((side: string) => {
      const amountOfQuotes = props.data[side].length
    })

    this.setExtremes(0, this.max)
    const charts = Highcharts.charts
    let orderBookChart: any
    charts.forEach((chart: any) => {
      if (chart !== undefined) {
        if (chart.title.textStr === 'order book') {
          orderBookChart = chart
        }
      }
    })
    charts.forEach((chart: any) => {
      if (
        chart !== undefined &&
        synchCharts &&
        chart.title.textStr === 'ohlc'
      ) {
        chart.yAxis[0].setExtremes(
          orderBookChart.yAxis[0].dataMin,
          orderBookChart.yAxis[0].dataMax,
        )
      }
    })
  }

  return (
    <div style={{ marginTop: '10px', marginLeft: '-40px' }}>
      <Typography display={'flex'} justifyContent={'center'}>
        <span
          style={{ color: 'green', fontSize: bidAskFontSize }}
        >{`Bid: ${bid}`}</span>
        &nbsp;&nbsp;
        <span style={{ fontSize: bidAskFontSize }}>{`Spread: ${spread}%`}</span>
        &nbsp;&nbsp;
        <span
          style={{ color: 'red', fontSize: bidAskFontSize }}
        >{`Ask: ${ask}`}</span>
      </Typography>
      <HighchartsReact
        highcharts={Highcharts}
        options={chartOptions}
        ref={orderBookChartRef}
      />
      <FormControlLabel
        style={{ marginLeft: '50px' }}
        control={<Switch />}
        label={
          <Typography fontSize={'10px'}>Synchrnoize with main chart</Typography>
        }
        value={synchCharts}
        onChange={(e, checked) => {
          setSynchCharts(checked)
        }}
      />
    </div>
  )
}

function OhlcChart(props: OhlcChartProps) {
  const chartRef = useRef<HighchartsReactRefObject>(null)
  const [chartOptions] = useState<any>({
    plotOptions: {
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
        top: '90%',
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
    ],
    title: {
      align: 'left',
      useHTML: true,
      text:
        props.cryptoInfo !== undefined &&
        `<img src=${props.cryptoMetaData?.logo} width=30 height=30 /> ${props.cryptoInfo.name} (${props.pair})`,
      style: {
        fontSize: '20px',
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
        if (chartRef.current) {
          const chart = chartRef.current.chart
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
    ],
    navigation: {
      annotationsOptions: {
        shapeOptions: {
          stroke: 'blue',
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
    if (
      chartRef.current &&
      chartRef.current.chart &&
      props.data !== undefined &&
      props.data !== null
    ) {
      chartRef.current.chart.series[0].setData(props.data)
      chartRef.current.chart.series[1].setData(props.volumeArray)
    }
  }, [props.data, props.volumeArray])

  useEffect(() => {
    if (chartRef.current && chartRef.current.chart) {
      const yAxisPlotLinesId = [
        'selectedOrderPrice',
        'supportLine',
        'resistanceLine',
      ]
      yAxisPlotLinesId.forEach((id: string) =>
        chartRef.current?.chart.series[0].yAxis.removePlotLine(id),
      )
      const xAxisPlotLinesId = ['selectedArticleDate', 'selectedOrderDate']
      xAxisPlotLinesId.forEach((id: string) =>
        chartRef.current?.chart.series[0].xAxis.removePlotLine(id),
      )
      chartRef.current.chart.series[0].name = props.pair
      chartRef.current.chart.setTitle({
        align: 'left',
        useHTML: true,
        text:
          props.cryptoInfo === undefined
            ? ''
            : `<img src=${props.cryptoMetaData?.logo} width=30 height=30 /> ${props.cryptoInfo.name} (${props.pair})`,
        style: {
          fontSize: '20px',
        },
      })
      chartRef.current.chart.series[0].yAxis.addPlotLine({
        color: 'white',
        width: 0.7,
        dashStyle: 'Dot',
        value: parseFloat(props.selectedOrder[1]),
        id: 'selectedOrderPrice',
      })
      chartRef.current.chart.series[0].yAxis.addPlotLine({
        color: 'red',
        width: 0.5,
        label: { text: 'support', style: { color: 'red' } },
        id: 'supportLine',
        value:
          props.pairScoreDetails !== undefined &&
          Object.keys(props.pairScoreDetails).includes('next_support')
            ? props.pairScoreDetails.next_support
            : null,
      })
      chartRef.current.chart.series[0].yAxis.addPlotLine({
        color: 'green',
        width: 0.5,
        label: { text: 'resistance', style: { color: 'green' } },
        id: 'resistanceLine',
        value:
          props.pairScoreDetails !== undefined &&
          Object.keys(props.pairScoreDetails).includes('next_resistance')
            ? props.pairScoreDetails.next_resistance
            : null,
      })
      chartRef.current.chart.series[0].xAxis.addPlotLine({
        color: 'white',
        width: 0.7,
        dashStyle: 'Dot',
        id: 'selectedArticleDate',
        value: new Date(props.selectedArticle[0]).getTime(),
      })
      chartRef.current.chart.series[0].xAxis.addPlotLine({
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

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={chartOptions}
      constructorType={'stockChart'}
      ref={chartRef}
    />
  )
}

function GreedAndFear(props: GreedAndFearChartProps) {
  const chartRef = useRef<HighchartsReactRefObject>(null)
  const [chartOptions] = useState<any>({
    credits: { enabled: false },
    chart: {
      inverted: true,
      backgroundColor: 'transparent',
      height: 60,
      width: 250,
    },
    title: {
      text: '',
    },
    xAxis: {
      labels: {
        enabled: false,
      },
      tickLength: true,
    },
    yAxis: {
      min: 0,
      max: 100,
      gridLineWidth: 0,
      minorTickInterval: 25,
      minorTickWidth: 0,
      minorTickLength: 1,
      minorGridLineWidth: 0,
      title: null,
      plotBands: [
        {
          from: 0,
          to: 24,
          color: '#8B0000',
        },
        {
          from: 25,
          to: 44,
          color: '#FF0000',
        },
        {
          from: 45,
          to: 55,
          color: 'orange',
        },
        {
          from: 56,
          to: 75,
          color: '#008000',
        },
        {
          from: 76,
          to: 100,
          color: '#006400',
        },
      ],
    },
    legend: {
      enabled: false,
    },
    tooltip: { enabled: false },
    stockTools: {
      gui: { enabled: false },
    },
    series: [
      {
        type: 'lineargauge',
        data:
          Object.keys(props.data).length !== 0
            ? [parseInt(props.data.data[0].value)]
            : [],
        color: 'white',
      },
    ] as any,
  })

  return (
    <div
      style={{
        textAlign: 'center',
        width: 250,
        position: 'absolute',
        padding: 10,
      }}
    >
      <span>Greed & Fear:</span>
      <span style={{ color: 'red' }}>
        {Object.keys(props.data).length !== 0 &&
          ` ${props.data.data[0].value} (${props.data.data[0].value_classification})`}
      </span>
      <div style={{ position: 'absolute', overflow: 'visible' }}>
        {Object.keys(props.data).length !== 0 && (
          <HighchartsReact
            highcharts={Highcharts}
            options={chartOptions}
            type="lineargauge"
            ref={chartRef}
          />
        )}
      </div>
    </div>
  )
}

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

  useEffect(() => {
    if (
      Object.keys(data.tradingData.ohlcvData).includes(pair) &&
      data.tradingData.ohlcvData[pair]
    ) {
      const volumeArrayData = data.tradingData.ohlcvData[pair]!.map((item) => [
        item[0],
        item[5],
      ])
      setVolumeArray(volumeArrayData)
    }
  }, [data.tradingData.ohlcvData[pair]])

  let decimalPlaces = 2
  try {
    decimalPlaces = data.tradingData.markets[pair].precision.price
      .toString()
      .split('.')[1].length
  } catch {}

  return (
    <div style={{ height: CHART_HEIGHT }}>
      <Row style={{ height: CHART_HEIGHT }}>
        <Col sm={10} style={{ zIndex: 1 }}>
          {loadingComponents['ohlcv'] && (
            <CircularProgress
              style={{ position: 'absolute', top: '30%', left: '40%' }}
            />
          )}
          {data.tradingData.ohlcvData[pair] === null ? (
            <Lottie
              animationData={data.tradingData.noDataAnimation}
              style={{ height: 600 }}
            />
          ) : (
            <OhlcChart
              data={data.tradingData.ohlcvData[pair]}
              exchange={exchange}
              pair={pair}
              selectedArticle={selectedArticle}
              selectedOrder={selectedOrder}
              pairScoreDetails={pairScoreDetails}
              volumeArray={volumeArray}
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
          {Object.keys(data.tradingData.greedAndFearData).length !== 0 && (
            <GreedAndFear data={data.tradingData.greedAndFearData} />
          )}
        </Col>
      </Row>
    </div>
  )
}
