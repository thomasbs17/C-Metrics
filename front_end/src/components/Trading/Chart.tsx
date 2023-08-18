import HighchartsReact from 'highcharts-react-official';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FilterState } from '../StateManagement';
import axios from 'axios';
import Highcharts from 'highcharts/highstock'
import { Col, Row, Spinner } from 'react-bootstrap';
import Lottie from 'lottie-react';
import CreateOrderWidget from './CreateOrder';
import HighchartsBoost from "highcharts/modules/boost";

HighchartsBoost(Highcharts);
const chartsHeight = 500;

type OrderBookItem = [number, number]

type OhlcData = number[][];

type OrderBookData = {
  asks: Array<[number, number]>;
  bids: Array<[number, number]>;
};

type PublicTradeItem = {
  price: number,
  amount: number
};


interface OrderBookChartProps {
  data: { 'bids': Array<OrderBookItem>, 'asks': Array<OrderBookItem> },
  zoomHandler: (event: Highcharts.AxisSetExtremesEventObject) => void;
  priceAxis: any
};

interface OhlcChartProps {
  data: { 'ohlc': OhlcData, 'publicTrades': Array<PublicTradeItem> };
  exchange: string;
  pair: string;
  zoomHandler: (event: Highcharts.AxisSetExtremesEventObject) => void;
  priceAxis: any
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

  if (orderBook['bids'].length != 0) {
    bidData.push([0, orderBook['bids'][0][0]])
  };
  orderBook['bids'].forEach(item => {
    cumulativeBid += item[1];
    if (item[0] >= minLowMaxHigh[0]) (
      bidData.push([cumulativeBid, item[0]])
    )
  });
  let cumulativeAsk = 0;
  let askData: OrderBookItem[] = [];
  if (orderBook['asks'].length != 0) {
    askData.push([0, orderBook['asks'][0][0]])
  };
  orderBook['asks'].forEach(item => {
    cumulativeAsk += item[1];
    if (item[0] <= minLowMaxHigh[1]) (
      askData.push([cumulativeAsk, item[0]])
    )
  });


  return { 'bids': bidData, 'asks': askData }
};

function getMinLowMaxHigh(ohlcData: OhlcData) {
  let ohlcPrices: Array<number> = []
  ohlcData.map((item: Array<number>) => ohlcPrices.push(item[2], item[3]));
  const minLow = Math.min(...ohlcPrices);
  const maxHigh = Math.max(...ohlcPrices);
  return [minLow, maxHigh]
};

function setOrderBookBoundaries(rawOrderBook: any, minLowMaxHigh: [number, number]) {
  let bidsData: Array<[number, number]> = [];
  let asksData: Array<[number, number]> = [];
  rawOrderBook['bids'].forEach((item: Array<number>) => {
    if (item[0] >= minLowMaxHigh[0]) {
      bidsData.push([item[0], item[1]])
    }
  })
  rawOrderBook['asks'].forEach((item: Array<number>) => {
    if (item[0] <= minLowMaxHigh[1]) {
      asksData.push([item[0], item[1]])
    }
  })
  return { 'asks': asksData, 'bids': bidsData };
}

function getChartBoundaries(event: Highcharts.AxisSetExtremesEventObject, ohlcData: OhlcData, cumulativeOrderBook: any) {

  let bookPrices: Array<number> = [];
  ['bids', 'asks'].forEach((side: string) => cumulativeOrderBook[side].map((item: any[]) => bookPrices.push(item[0])))

  let ohlcPrices: Array<number> = []
  ohlcData.map((item: Array<number>) => (item[0] >= event.min && item[0] <= event.max) && ohlcPrices.push(item[2], item[3]));
  const minLow = Math.min(...ohlcPrices);
  const maxHigh = Math.max(...ohlcPrices);

  const lowerBoundary = Math.min(minLow); // ...bookPrices
  const upperBoundary = Math.max(maxHigh); //...bookPrices
  return [lowerBoundary, upperBoundary];
};

function OrderBookChart(props: OrderBookChartProps) {

  let spread = 'N/A'
  if (props.data.bids.length > 0 && props.data.asks.length > 0) {
    spread = ((props.data.asks[0][1] / props.data.bids[0][1] - 1) * 100).toFixed(2);
  }
  const options = {
    boost: {
      useGPUTranslations: true,
      // Chart-level boost when there are more than 5 series in the chart
      seriesThreshold: 5
    },
    xAxis: [
      {
        type: 'linear',
        labels: { enabled: false, },
        crosshair: {
          color: 'gray',
          width: 1,
        },
        snap: false,
        events: {
          setExtremes: props.zoomHandler
        }
      },
    ],
    yAxis: [
      props.priceAxis
    ],
    title: {
      text: `Spread: ${spread}%`,
      margin: 0,
      style: {
        fontSize: '15px'
      }
    },
    series: [
      {
        data: props.data.bids,
        name: 'Bids',
        yAxis: 0,
        color: 'green',
        fillColor: {
          linearGradient: [300, 0, 0, 300], // Adjust the gradient as needed
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
    chart: {
      backgroundColor: 'transparent',
      height: chartsHeight,
      panning: true,
      panKey: 'shift'
    },
    credits: { enabled: false },
  };
  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
    />
  );
}

function OhlcChart(props: OhlcChartProps) {
  const volumeArray = props.data['ohlc'].map(item => [item[0], item[4]]);
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
        opposite: false,
        events: {
          setExtremes: props.zoomHandler
        }
      },
      {
        type: 'linear',
        opposite: true,
        gridLineWidth: 0,
        width: '50%',
        zIndex: -1
      },
    ],
    yAxis: [
      props.priceAxis,
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
        data: props.data['ohlc'],
        name: props.pair,
        type: 'ohlc',
        yAxis: 0,
      },
      // {
      //   data: volumeArray,
      //   name: 'volume',
      //   type: 'column',
      //   yAxis: 1,
      // },
      {
        data: props.data['publicTrades'].map(item => [item['amount'], item['price']]),
        name: 'Volume Profile',
        type: 'scatter',
        categories: props.data['publicTrades'].map(item => [item['price']]),
        grouping: false,
        xAxis: 1,
        yAxis: 0,
        color: 'rgba(100,100,100,0.5)'
      }
    ],
    chart: {
      backgroundColor: 'transparent',
      height: chartsHeight + 55,
    },
    credits: { enabled: false },
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
  const [minLowMaxHigh, setMinLowMaxHigh] = useState<[number, number]>([0, 0])
  const [orderBookData, setOrderBookData] = useState<OrderBookData>(emptyOrderBook);
  const [publicTrades, setPublicTrades] = useState<Array<PublicTradeItem>>([]);
  const [chartBoundaries, setChartBoundaries] = useState<[number, number]>([0, 0]);

  const [isLoading, setIsLoading] = useState(true);

  async function fetchOHLCData(pair: string) {
    try {
      setIsLoading(true);
      const ohlc_response = await axios.get(
        `http://127.0.0.1:8000/ohlc/?exchange=${exchange}&pair=${pair}`
      );
      setOHLCData(ohlc_response.data);
      setMinLowMaxHigh(getMinLowMaxHigh(ohlc_response.data) as [number, number]);
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
        `http://127.0.0.1:8000/order_book/?exchange=${exchange}&pair=${pair}`
      );
      const responseData = orderBookResponse.data;
      const data = setOrderBookBoundaries(responseData, minLowMaxHigh)
      setOrderBookData(data);
    } catch (error) {
      setOrderBookData(emptyOrderBook);
      console.error('Error fetching Order data:', error);
    }
  };
  async function fetchPublicTrades(pair: string) {
    try {
      const publicTradesResponse = await axios.get(
        `http://127.0.0.1:8000/public_trades/?exchange=${exchange}&pair=${pair}`
      );
      setPublicTrades(publicTradesResponse.data);
    } catch (error) {
      setPublicTrades([]);
      console.error('Error fetching Public Trades data:', error);
    }
  };

  useEffect(() => {
    setChartBoundaries([minLowMaxHigh[0], minLowMaxHigh[1]]);
    fetchOHLCData(pair);
    // fetchOrderBookData(pair);
    fetchPublicTrades(pair);
    // setOrderBookData(emptyOrderBook);
    const wsUrl = `ws://localhost:8765?exchange=${exchange}&pair=${pair}`
    const socket = new WebSocket(wsUrl);
    socket.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      if (newData != undefined && Object.keys(newData).includes('bids')) { setOrderBookData(newData) }
    };

    // const orderBookInterval = setInterval(() => { fetchOrderBookData(pair) }, 5000);
    const ohlcInterval = setInterval(() => { fetchOHLCData(pair) }, 60000);
    const publicTradesInterval = setInterval(() => { fetchPublicTrades(pair) }, 60000);
    // Cleanup the interval when component unmounts
    return () => {
      socket.close()
      // clearInterval(orderBookInterval)
      clearInterval(ohlcInterval)
      clearInterval(publicTradesInterval)
    }
  },
    [exchange, pair, tradingType]);

  const orderBookChartData = buildCumulativeVolume(orderBookData, minLowMaxHigh);
  const ohlcChartData = { 'ohlc': ohlcData, 'publicTrades': publicTrades }

  const handleZoomChange = (event: Highcharts.AxisSetExtremesEventObject) => {
    const boundaries = getChartBoundaries(event, ohlcData, orderBookChartData) as [number, number];
    if (
      (!(isNaN(boundaries[0])))
      && (!(isNaN(boundaries[1])))
      && (isFinite(boundaries[1]))
    ) {
      setChartBoundaries(boundaries)
    }
  };

  const priceAxis = {
    labels: {
      align: 'left'
    },
    resize: {
      enabled: true
    },
    title: {text: ''},
    crosshair: {
      color: 'gray',
      dashStyle: 'solid',
      snap: false
    },
    lineWidth: 2,
    gridLineWidth: 0.2,
    min: chartBoundaries[0],
    max: chartBoundaries[1],
    event: {
      setExtremes: handleZoomChange
    }
  };

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
            <OhlcChart data={ohlcChartData} exchange={exchange} pair={pair} zoomHandler={handleZoomChange} priceAxis={priceAxis} />
          </Col>
          <Col sm={2} style={{ marginLeft: '-50px', zIndex: 2 }}>
            <OrderBookChart data={orderBookChartData} zoomHandler={handleZoomChange} priceAxis={priceAxis} />
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