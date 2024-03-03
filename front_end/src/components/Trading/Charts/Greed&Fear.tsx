import Highcharts from 'highcharts'
import HighchartsReact, {
  HighchartsReactRefObject,
} from 'highcharts-react-official'
import { useEffect, useRef, useState } from 'react'

LinearGauge(Highcharts)

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

interface GreedAndFearChartProps {
  data: any
}

export function GreedAndFear(props: GreedAndFearChartProps) {
  const chartRef = useRef<HighchartsReactRefObject>(null)
  const [categoryColor, setCategoryColor] = useState<string>('')
  const indexRanges = [
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
  ]

  function getColor(currentValue: number) {
    let color = ''
    indexRanges.forEach((rangeDetails) => {
      if (
        rangeDetails['from'] <= currentValue &&
        rangeDetails['to'] > currentValue
      ) {
        color = rangeDetails['color']
      }
    })
    return color
  }

  useEffect(() => {
    const catColor = getColor(props.data.data[0].value)
    setCategoryColor(catColor)
  }, [props.data.data[0].value])

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
      plotBands: indexRanges,
    },
    legend: {
      enabled: false,
    },
    tooltip: { enabled: false },
    stockTools: {
      gui: { enabled: false },
    },
    navigation: {
      bindingsClassName: 'greed-and-fear-chart',
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
        fontSize: 13,
        position: 'absolute',
        right: '3%',
      }}
    >
      <span>Greed & Fear:</span>
      <span style={{ color: categoryColor }}>
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
