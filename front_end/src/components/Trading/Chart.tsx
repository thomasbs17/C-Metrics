import {
  CircularProgress,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material'
import HighchartsReact, {
  HighchartsReactRefObject,
} from 'highcharts-react-official'
import Highcharts from 'highcharts/highstock'
import IndicatorsAll from 'highcharts/indicators/indicators-all'
import HighchartsBoost from 'highcharts/modules/boost'
import { useEffect, useRef, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useSelector } from 'react-redux'
import {
  OhlcData,
  OrderBookData,
  retrieveInfoFromCoinMarketCap,
  tradingDataDef,
} from '../DataManagement'
import { FilterState } from '../StateManagement'

const CHART_HEIGHT = 600

// exporting(Highcharts);
// exportData(Highcharts);
LinearGauge(Highcharts)
IndicatorsAll(Highcharts)
HighchartsBoost(Highcharts)

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
      var series = this,
        chart = this.chart,
        inverted = chart.inverted,
        xAxis = this.xAxis,
        yAxis = this.yAxis,
        point = this.points[0],
        markLine = this.markLine,
        ani = markLine ? 'animate' : 'attr'
      point.graphic.hide()

      if (!markLine) {
        var path = inverted
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
  selectedOrder: [string, number, string]
  pairScoreDetails: any
}

interface OhlcChartProps {
  data: OhlcData
  exchange: string
  pair: string
  selectedArticle: [string, string]
  selectedOrder: [string, number, string]
  pairScoreDetails: any
  volumeArray: number[][]
}

interface GreedAndFearChartProps {
  data: any
}

function getSpread(bookData: OrderBookData) {
  let spread = 'N/A'
  if (
    Object.keys(bookData).length !== 0 &&
    bookData.bids.length > 0 &&
    bookData.asks.length > 0
  ) {
    spread = ((bookData.asks[0][1] / bookData.bids[0][1] - 1) * 100).toFixed(2)
  }
  return spread
}

function OrderBookChart(props: BookChartProps) {
  const orderBookChartRef = useRef<HighchartsReactRefObject>(null)
  const bidAskFontSize = '13px'
  const spread = getSpread(props.data)
  const bid = props.data.bids[0][1].toLocaleString()
  const ask = props.data.asks[0][1].toLocaleString()
  const [synchCharts, setSynchCharts] = useState(false)
  const [chartOptions] = useState<any>({
    boost: {
      useGPUTranslations: true,
    },
    tooltip: {
      enabled: true,
      split: false,
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
      },
    ],
    title: {
      text: `order book`,
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
    chart: {
      backgroundColor: 'transparent',
      height: CHART_HEIGHT - 215,
    },
    exporting: {
      enabled: true,
      menuItemDefinitions: { viewFullscreen: {} },
      buttons: { contextButton: { text: 'te' } },
    },
    legend: {
      enabled: false,
    },
    credits: { enabled: false },
  })

  useEffect(() => {
    if (orderBookChartRef.current && orderBookChartRef.current.chart) {
      orderBookChartRef.current.chart.series[0].setData(props.data.bids)
      orderBookChartRef.current.chart.series[1].setData(props.data.asks)
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
          value: Object.keys(props.pairScoreDetails).includes('next_support')
            ? props.pairScoreDetails['next_support']
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
          value: Object.keys(props.pairScoreDetails).includes('next_resistance')
            ? props.pairScoreDetails['next_resistance']
            : null,
        })
      })
    }
  }, [props.pairScoreDetails, props.selectedOrder])

  function afterSetExtremes(this: any, e: any) {
    this.setExtremes(0, this.max)
    const charts = Highcharts.charts
    let orderBookChart: any = undefined
    charts.forEach((chart: any) => {
      if (chart !== undefined) {
        if (chart.title.textStr === 'order book') {
          orderBookChart = chart
        }
      }
    })
    charts.forEach((chart: any) => {
      if (chart !== undefined) {
        if (synchCharts) {
          if (chart.title.textStr === 'ohlc') {
            if (synchCharts) {
              chart.yAxis[0].setExtremes(
                orderBookChart.yAxis[0].dataMin,
                orderBookChart.yAxis[0].dataMax,
              )
            }
          }
        }
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
        onChange={(e, checked) => setSynchCharts(checked)}
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
        height: '80%',
      },
      {
        title: {
          text: '',
        },
        top: '70%',
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
        title: {
          text: '',
        },
        top: '80%',
        height: '20%',
        gridLineWidth: 0,
        plotLines: [
          {
            color: 'red',
            width: 0.5,
            value: 30,
          },
          {
            color: 'green',
            width: 0.5,
            value: 70,
          },
        ],
        crosshair: {
          color: 'gray',
          dashStyle: 'solid',
          snap: false,
          label: {
            enabled: true,
            backgroundColor: 'transparent',
            formatter: function (value: number) {
              return value.toFixed(0)
            },
          },
        },
      },
    ],
    title: {
      text: `ohlc`,
      style: {
        fontSize: 0,
      },
    },
    tooltip: {
      enabled: false,
    },
    series: [
      {
        data: [],
        name: props.pair,
        type: 'ohlc',
        yAxis: 0,
        id: 'ohlc',
        point: {
          events: {
            mouseOver: () => console.log('test'),
          },
        },
      },
      {
        data: [],
        name: 'volume',
        type: 'column',
        yAxis: 1,
      },
      // {
      //   type: 'bb',
      //   linkedTo: 'ohlc',
      //   opacity: 1,
      //   lineWidth: 0,
      //   color: 'blue'
      // }
    ],
    chart: {
      backgroundColor: 'transparent',
      height: CHART_HEIGHT,
    },
    credits: { enabled: false },
  })

  useEffect(() => {
    if (chartRef.current && chartRef.current.chart) {
      chartRef.current.chart.series[0].setData(props.data)
      chartRef.current.chart.series[1].setData(props.volumeArray)
      chartRef.current.chart.addSeries({
        type: 'rsi',
        name: 'rsi',
        yAxis: 2,
        linkedTo: 'ohlc',
        marker: {
          enabled: false,
        },
      })
    }
  }, [props.data, props.volumeArray])

  useEffect(() => {
    if (chartRef.current && chartRef.current.chart) {
      const yAxisPlotLinesId = [
        'selectedOrderPrice',
        'supportLine',
        'resistanceLine',
      ]
      yAxisPlotLinesId.forEach((id: string) => {
        chartRef.current?.chart.series[0].yAxis.removePlotLine(id)
      })
      const xAxisPlotLinesId = ['selectedArticleDate', 'selectedOrderDate']
      xAxisPlotLinesId.forEach((id: string) => {
        chartRef.current?.chart.series[0].xAxis.removePlotLine(id)
      })

      chartRef.current.chart.series[0].yAxis.addPlotLine({
        color: 'white',
        width: 0.7,
        dashStyle: 'Dot',
        value: props.selectedOrder[1],
        id: 'selectedOrderPrice',
      })
      chartRef.current.chart.series[0].yAxis.addPlotLine({
        color: 'red',
        width: 0.5,
        label: { text: 'support', style: { color: 'red' } },
        id: 'supportLine',
        value: Object.keys(props.pairScoreDetails).includes('next_support')
          ? props.pairScoreDetails['next_support']
          : null,
      })
      chartRef.current.chart.series[0].yAxis.addPlotLine({
        color: 'green',
        width: 0.5,
        label: { text: 'resistance', style: { color: 'green' } },
        id: 'resistanceLine',
        value: Object.keys(props.pairScoreDetails).includes('next_resistance')
          ? props.pairScoreDetails['next_resistance']
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
    series: [
      {
        type: 'lineargauge',
        data:
          Object.keys(props.data).length !== 0
            ? [parseInt(props.data['data'][0]['value'])]
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
          ` ${props.data['data'][0]['value']} (${props.data['data'][0]['value_classification']})`}
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
  const [exchange, pair, selectedOrder, pairScoreDetails, selectedArticle] =
    useSelector((state: { filters: FilterState }) => [
      state.filters.exchange,
      state.filters.pair,
      state.filters.selectedOrder,
      state.filters.pairScoreDetails,
      state.filters.selectedArticle,
    ])

  const [cryptoInfo, setCryptoInfo] = useState<any>({})
  const [volumeArray, setVolumeArray] = useState<number[][]>([])

  useEffect(() => {
    setCryptoInfo(
      retrieveInfoFromCoinMarketCap(
        pair as string,
        data.tradingData.coinMarketCapMapping,
      ),
    )
  }, [pair, data.tradingData.coinMarketCapMapping])

  useEffect(() => {
    const volumeArrayData = data.tradingData.ohlcvData.map((item) => [
      item[0],
      item[5],
    ])
    setVolumeArray(volumeArrayData)
  }, [data.tradingData.ohlcvData])

  return (
    <div style={{ height: CHART_HEIGHT }}>
      <Row style={{ height: CHART_HEIGHT }}>
        <Col sm={10} style={{ zIndex: 1 }}>
          {cryptoInfo !== undefined && Object.keys(cryptoInfo).length > 0 && (
            <div style={{ position: 'absolute', marginTop: 40, marginLeft: 5 }}>
              <Typography variant="h5">{cryptoInfo.name}</Typography>
              {cryptoInfo.platform !== null &&
                `Network: ${cryptoInfo.platform.name}`}
            </div>
          )}
          {data.tradingData.ohlcvData.length === 0 ? (
            <CircularProgress
              style={{ position: 'absolute', top: '30%', left: '40%' }}
            />
          ) : (
            <OhlcChart
              data={data.tradingData.ohlcvData}
              exchange={exchange as string}
              pair={pair as string}
              selectedArticle={selectedArticle}
              selectedOrder={selectedOrder}
              pairScoreDetails={pairScoreDetails}
              volumeArray={volumeArray}
            />
          )}
        </Col>
        <Col sm={2} style={{ zIndex: 2 }}>
          {Object.keys(data.tradingData.orderBookData).includes('bids') &&
            data.tradingData.orderBookData.bids.length !== 0 && (
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
