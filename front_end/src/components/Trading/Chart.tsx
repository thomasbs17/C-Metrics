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
import VDP from 'highcharts/indicators/volume-by-price'
import HighchartsBoost from 'highcharts/modules/boost'
import { useEffect, useMemo, useRef, useState } from 'react'
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
VDP(Highcharts)

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
  selectedOrder: [string, string, string]
  pairScoreDetails: any
}

interface OhlcChartProps {
  data: OhlcData
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
  const bid = props.data.bid[0][1].toLocaleString()
  const ask = props.data.ask[0][1].toLocaleString()
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
      orderBookChartRef.current.chart.series[0].setData(props.data.bid)
      orderBookChartRef.current.chart.series[1].setData(props.data.ask)
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
  const amountOfPoints = props.data.length - 1
  const [selectedPoint, setSelectedPoint] = useState<any>({
    open: props.data[amountOfPoints][1],
    high: props.data[amountOfPoints][2],
    low: props.data[amountOfPoints][3],
    close: props.data[amountOfPoints][4],
    color:
      props.data[amountOfPoints][4] > props.data[amountOfPoints][1]
        ? 'green'
        : 'red',
  })
  const handleHover = (e: any) => {
    setSelectedPoint({
      open: e.target.open,
      high: e.target.high,
      low: e.target.low,
      close: e.target.close,
      color: e.target.color,
    })
  }
  const handleMouseOut = () => {
    setSelectedPoint({
      open: props.data[amountOfPoints][1],
      high: props.data[amountOfPoints][2],
      low: props.data[amountOfPoints][3],
      close: props.data[amountOfPoints][4],
      color:
        props.data[amountOfPoints][4] > props.data[amountOfPoints][1]
          ? 'green'
          : 'red',
    })
  }

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
            mouseOver: (e: any) => handleHover(e),
            mouseOut: () => handleMouseOut(),
          },
        },
      },
      {
        data: [],
        name: 'volume',
        type: 'column',
        id: 'volume',
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
      props.volumeArray.length !== 0 &&
        chartRef.current.chart.addSeries({
          type: 'vbp',
          linkedTo: 'ohlc',
          params: {
            ranges: 24,
            volumeSeriesID: 'volume',
          },
          dataLabels: {
            enabled: false,
          },
          zoneLines: {
            enabled: false,
          },
          opacity: 0.1,
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
        value: parseFloat(props.selectedOrder[1]),
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
    <div>
      {props.cryptoInfo !== undefined &&
        props.cryptoMetaData !== undefined &&
        Object.keys(props.cryptoInfo).length > 0 &&
        Object.keys(props.cryptoMetaData).length > 0 && (
          <div
            style={{
              position: 'absolute',
              marginTop: 40,
              padding: 5,
              display: 'flex',
            }}
          >
            <img
              src={props.cryptoMetaData['logo']}
              alt={`${props.pair}-logo`}
              width={30}
              height={30}
            />
            <Typography variant="h5">{props.cryptoInfo.name}</Typography>
            <div style={{ display: 'flex', marginTop: 5, marginLeft: 5 }}>
              <p style={{ marginLeft: 5 }}>
                <span>O:</span>
                <span style={{ color: selectedPoint.color }}>
                  {selectedPoint.open.toLocaleString('en-US', {
                    minimumFractionDigits: props.decimalPlaces,
                    maximumFractionDigits: props.decimalPlaces,
                  })}
                </span>
              </p>
              <p style={{ marginLeft: 5 }}>
                <span>H:</span>
                <span style={{ color: selectedPoint.color }}>
                  {selectedPoint.high.toLocaleString('en-US', {
                    minimumFractionDigits: props.decimalPlaces,
                    maximumFractionDigits: props.decimalPlaces,
                  })}
                </span>
              </p>
              <p style={{ marginLeft: 5 }}>
                <span>L:</span>
                <span style={{ color: selectedPoint.color }}>
                  {selectedPoint.low.toLocaleString('en-US', {
                    minimumFractionDigits: props.decimalPlaces,
                    maximumFractionDigits: props.decimalPlaces,
                  })}
                </span>
              </p>
              <p style={{ marginLeft: 5 }}>
                <span>C:</span>
                <span style={{ color: selectedPoint.color }}>
                  {selectedPoint.close.toLocaleString('en-US', {
                    minimumFractionDigits: props.decimalPlaces,
                    maximumFractionDigits: props.decimalPlaces,
                  })}
                </span>
              </p>
              <p style={{ marginLeft: 5 }}>
                <span>%:</span>
                <span style={{ color: selectedPoint.color }}>
                  {(
                    (selectedPoint.close / selectedPoint.open - 1) *
                    100
                  ).toFixed(2)}
                  %
                </span>
              </p>
            </div>
          </div>
        )}
      <HighchartsReact
        highcharts={Highcharts}
        options={chartOptions}
        constructorType={'stockChart'}
        ref={chartRef}
      />
    </div>
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
  const filterState = useSelector(
    (state: { filters: FilterState }) => state.filters,
  )

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
  const [volumeArray, setVolumeArray] = useState<number[][]>([])

  useEffect(() => {
    setCryptoInfo(
      retrieveInfoFromCoinMarketCap(
        pair as string,
        data.tradingData.coinMarketCapMapping,
      ),
    )
    if (
      cryptoInfo &&
      Object.keys(cryptoInfo).length !== 0 &&
      data.tradingData.cryptoMetaData.length !== 0
    ) {
      setCryptoMetaData(
        data.tradingData.cryptoMetaData['data'][cryptoInfo['id']],
      )
    }
  }, [
    pair,
    data.tradingData.coinMarketCapMapping,
    data.tradingData.cryptoMetaData,
    cryptoInfo,
  ])

  useEffect(() => {
    const volumeArrayData = data.tradingData.ohlcvData.map((item) => [
      item[0],
      item[5],
    ])
    setVolumeArray(volumeArrayData)
  }, [data.tradingData.ohlcvData])

  let decimalPlaces = 2
  try {
    decimalPlaces = data.tradingData.markets[pair]['precision']['price']
      .toString()
      .split('.')[1].length
  } catch {}

  return (
    <div style={{ height: CHART_HEIGHT }}>
      <Row style={{ height: CHART_HEIGHT }}>
        <Col sm={10} style={{ zIndex: 1 }}>
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
