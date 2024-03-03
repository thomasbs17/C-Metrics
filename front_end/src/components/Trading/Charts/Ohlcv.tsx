import HighchartsReact, {
  HighchartsReactRefObject,
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
import { useEffect, useRef, useState } from 'react'
import '../../../css/charts.css'
import { OhlcData, tradingDataDef } from '../../DataManagement'
import { CHART_HEIGHT } from './common'

IndicatorsAll(Highcharts)
HighchartsBoost(Highcharts)
StockTools(Highcharts)
VDP(Highcharts)
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

export function OhlcChart(props: OhlcChartProps) {
  const ohlcvChartRef = useRef<HighchartsReactRefObject>(null)
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
  }, [chartOptions, props.data])

  useEffect(() => {
    const chart = ohlcvChartRef.current!.chart
    if (chart) {
      const yAxisPlotLinesId = [
        'selectedOrderPrice',
        'supportLine',
        'resistanceLine',
      ]
      yAxisPlotLinesId.forEach((id: string) =>
        chart.series[0].yAxis.removePlotLine(id),
      )
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
      chart.series[0].yAxis.addPlotLine({
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
      chart.series[0].yAxis.addPlotLine({
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
    // const latestTimestamp = data![data!.length - 1][0]
    // this.setExtremes(this.min, latestTimestamp)
  }

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={chartOptions}
      constructorType={'stockChart'}
      ref={ohlcvChartRef}
    />
  )
}
