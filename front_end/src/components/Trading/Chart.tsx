// import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FilterState } from '../StateManagement';
import axios from 'axios';
import Highcharts from 'highcharts/highstock'
import { Alert, Col, Container, Row, Spinner } from 'react-bootstrap';
import Lottie from 'lottie-react';
import CreateOrderWidget from './CreateOrder';

const chartsHeight = 500;

type OrderBookItem = [number, number]

type OhlcData = number[][];

type OrderBookData = {
  asks: OrderBookItem[];
  bids: OrderBookItem[];
  datetime: string;
  nonce: null;
  symbol: string;
  timestamp: number;
};

interface OrderBookChartProps {
  data: { 'bids': Array<OrderBookItem>, 'asks': Array<OrderBookItem> },
  options: Highcharts.Options;
  minLowMaxHigh: [number, number]
};

interface OhlcChartProps {
  data: OhlcData;
  exchange: string;
  pair: string;
  options: Highcharts.Options;
};



const emptyOrderBook = {
  asks: [],
  bids: [],
  datetime: "",
  nonce: null,
  symbol: "",
  timestamp: 0,
}

function NoDataAnimation() {
  const animationUrl = 'https://lottie.host/010ee17d-3884-424d-b64b-c38ed7236758/wy6OPJZDbJ.json';
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    async function fetchAnimationData() {
      try {
        const response = await axios.get(animationUrl);
        setAnimationData(response.data);
      } catch (error) {
        console.error('Error fetching animation data:', error);
      }
    }
    fetchAnimationData();
  }, []);

  return (
    <div>
      <Lottie animationData={animationData} style={{ height: chartsHeight }} />
    </div>
  );
}

function buildCumulativeVolume(orderBook: OrderBookData, minLowMaxHigh: [number, number]) {
  let cumulativeBid = 0;
  let bidData: OrderBookItem[] = []
  orderBook['bids'].forEach(item => {
    cumulativeBid += item[1];
    if (item[0] >= minLowMaxHigh[0]) (
      bidData.push([cumulativeBid, item[0]])
    )
  });
  // if (bidData.length != 0) {
  //   bidData.push([0, bidData[0][1]])
  // }
  // if (bidData.length != 0 && bidData[bidData.length - 1][1] > minLowMaxHigh[0]) {
  //   bidData.push([0, minLowMaxHigh[0]])
  // }

  let cumulativeAsk = 0;
  let askData: OrderBookItem[] = [];

  orderBook['asks'].forEach(item => {
    cumulativeAsk += item[1];
    if (item[0] <= minLowMaxHigh[1]) (
      askData.push([cumulativeAsk, item[0]])
    )
  });
  // if (askData.length != 0 && askData[askData.length - 1][1] < minLowMaxHigh[1]) {
  //   askData.push([0, minLowMaxHigh[1]])
  // }
  // if (askData.length != 0) {
  //   askData.push([0, askData[0][1]])
  // }

  return { 'bids': bidData, 'asks': askData }
};


function findMinMaxHighLow(ohlcData: OhlcData) {
  let minLow = Number.POSITIVE_INFINITY;
  let maxHigh = Number.NEGATIVE_INFINITY;

  for (const dataPoint of ohlcData) {
    const [timestamp, open, high, low, close, volume] = dataPoint;
    if (low < minLow) {
      minLow = low;
    }
    if (high > maxHigh) {
      maxHigh = high;
    }
  }
  return [minLow, maxHigh];
};

function OrderBookChart(props: OrderBookChartProps) {

  const options = {
    xAxis: [
      {
        type: 'linear',
        labels: { enabled: false, },
        crosshair: {
          color: 'gray', // Choose your crosshair color
          width: 1,      // Choose your crosshair width
        },
        snap: false,
      },
    ],
    yAxis: [
      {
        height: '70%',
        labels: { enabled: false, },
        title: {
          text: ''
        },
        id: 'priceAxis',
        gridLineWidth: 0,
        snap: false,
        min: props.minLowMaxHigh[0],
        max: props.minLowMaxHigh[1]
      },
    ],
    title: {
      text: ''
    },
    series: [
      {
        data: props.data.bids,
        name: 'Bids',
        yAxis: 0,
        color: 'green',
        fillColor: {
          linearGradient: [0, 0, 0, 300], // Adjust the gradient as needed
          stops: [
            [0, 'rgba(0, 128, 0, 1)'], // Adjust the color and opacity as needed
            [1, 'rgba(0, 0, 0, 1)']      // Adjust the color and opacity as needed
          ]
        },
        type: 'area' // Use 'area' type for area chart
      },
      {
        data: props.data.asks,
        name: 'Asks',
        yAxis: 0,
        color: 'red',
        fillColor: {
          linearGradient: [0, 0, 0, 300], // Adjust the gradient as needed
          stops: [
            [0, 'rgba(0, 0, 0, 1)'], // Adjust the color and opacity as needed
            [1, 'rgba(255, 0, 0, 0']
          ]
        },
        threshold: Infinity,
        type: 'area' // Use 'area' type for area chart
      },
    ],
    chart: { backgroundColor: 'transparent', height: chartsHeight },
    credits: { enabled: false },
    ...props.options,
  };
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
    />
  );
}

function OhlcChart(props: OhlcChartProps) {
  const volumeArray = props.data.map(item => [item[0], item[4]]);
  const options = {
    plotOptions: {
      ohlc: {
        color: 'red',
        upColor: 'green'
      }
    },
    xAxis: [
      {
        type: 'datetime',
        crosshair: {
          color: 'gray',
          width: 1,
          snap: false
        },
      },
    ],
    yAxis: [
      {
        labels: {
          align: 'right',
          x: -3
        },
        title: {
          text: 'OHLC'
        },
        height: '70%',
        lineWidth: 2,
        resize: {
          enabled: true
        },
        gridLineWidth: 0.2,
        id: 'priceAxis',
        crosshair: {
          color: 'gray',
          dashStyle: 'solid',
          snap: false
        },
      },
      {
        labels: {
          align: 'right',
          x: 3,
        },
        title: {
          text: 'Volume'
        },
        top: '80%',
        height: '20%',
        offset: 0,
        lineWidth: 2
      }
    ],
    rangeSelector: {
      selected: 2
    },
    title: {
      text: ``
    },
    series: [
      {
        data: props.data,
        name: props.pair,
        type: 'ohlc',
        yAxis: 0,
      },
      {
        data: volumeArray,
        name: 'volume',
        type: 'column',
        yAxis: 1,
      }
    ],
    chart: { backgroundColor: 'transparent', height: chartsHeight },
    credits: { enabled: false },
    ...props.options,
  };
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
      constructorType={'stockChart'}
    />
  );
};

export function TradingChart() {
  const { tradingType, exchange, currency, asset } = useSelector((state: FilterState) => state);
  const pair = `${asset}/${currency}`;
  const [ohlcData, setOHLCData] = useState<OhlcData>([]);
  const [orderBookData, setOrderBookData] = useState<OrderBookData>(emptyOrderBook);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchOHLCData(pair: string) {
    try {
      setIsLoading(true);
      const ohlc_response = await axios.get(
        `http://localhost:8000/ohlc/?exchange=${exchange}&pair=${pair}`
      );
      // console.log('RAW OHLC');
      // console.log(ohlc_response.data)
      setOHLCData(ohlc_response.data);
    } catch (error) {
      setOHLCData([]);
      console.error('Error fetching OHLC data:', error);
    } finally {
      setIsLoading(false);
    };
  };

  async function fetchOrderBookData(pair: string) {
    try {
      const orderBookResponse = await axios.get(
        `http://localhost:8000/order_book/?exchange=${exchange}&pair=${pair}`
      );
      setOrderBookData(orderBookResponse.data);
    } catch (error) {
      setOrderBookData(emptyOrderBook);
      console.error('Error fetching Order data:', error);
    }
  }

  useEffect(() => {
    fetchOHLCData(pair);
    fetchOrderBookData(pair);
    const orderBookInterval = setInterval(() => { fetchOrderBookData(pair) }, 5000);
    const ohlcInterval = setInterval(() => { fetchOHLCData(pair) }, 60000);
    // Cleanup the interval when component unmounts
    return () => {
      clearInterval(orderBookInterval)
      clearInterval(ohlcInterval)
    }
  },
    [exchange, pair, tradingType]);

  const minLowMaxHigh = findMinMaxHighLow(ohlcData) as [number, number];
  // console.log(minLowMaxHigh)
  const orderBookChartData = buildCumulativeVolume(orderBookData, minLowMaxHigh);
  // console.log('OHLC')
  // console.log(ohlcData)
  // console.log('Order Book')
  // console.log(orderBookChartData)


  return (
    <div style={{ height: chartsHeight }}>
      {isLoading ?
        <Spinner animation="border" role="status" style={{ position: 'absolute', top: '30%', left: '35%' }}>
          < span className="visually-hidden" > Loading...</span >
        </Spinner >
        : null}
      {ohlcData.length != 0 ?
        <Row style={{ height: chartsHeight }}>
          <Col sm={9} style={{ zIndex: 1 }}>
            <OhlcChart data={ohlcData} exchange={exchange} pair={pair} options={{}} />
          </Col>
          <Col sm={2} style={{ marginLeft: '-50px', zIndex: 2 }}>
            <OrderBookChart data={orderBookChartData} options={{}} minLowMaxHigh={minLowMaxHigh} />
          </Col>
          <Col>
            <CreateOrderWidget />
          </Col>
        </Row>
        :
        <NoDataAnimation />
      }
    </div>
  )
}