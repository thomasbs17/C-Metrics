import HighchartsReact from 'highcharts-react-official';
import { SetStateAction, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FilterState } from '../StateManagement';
import axios from 'axios';
import Highcharts from 'highcharts/highstock'
import { Col, Row, Spinner } from 'react-bootstrap';
import Lottie from 'lottie-react';
import CreateOrderWidget from './CreateOrder';
import HighchartsBoost from "highcharts/modules/boost";
import { FormControlLabel, Switch } from '@mui/material';

HighchartsBoost(Highcharts);
const chartsHeight = 500;

type OhlcData = number[][];

type OrderBookData = {
  [key: string]: Array<[number, number]>;
};

type PublicTradeItem = {
  price: number,
  amount: number
};

interface BookChartProps {
  data: OrderBookData
  zoomHandler: (event: Highcharts.AxisSetExtremesEventObject) => void;
  priceAxis: any;
  synchCharts: boolean
};

interface OhlcChartProps {
  data: { 'ohlc': OhlcData, 'publicTrades': Array<PublicTradeItem> };
  exchange: string;
  pair: string;
  zoomHandler: (event: Highcharts.AxisSetExtremesEventObject) => void;
  priceAxis: any
};

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

function formatOrderBook(rawOrderBook: { [x: string]: { [x: string]: number; }; }) {
  let formattedBook: OrderBookData = { 'bids': [], 'asks': [] };
  ['bids', 'asks'].forEach((side: string) => {
    let cumulativeVolume = 0;
    const sortedPrices = side === 'bids' ?
      Object.keys(rawOrderBook[side]).sort((a, b) => parseFloat(b) - parseFloat(a))
      : Object.keys(rawOrderBook[side]).sort((a, b) => parseFloat(a) - parseFloat(b));
    formattedBook[side].push([0, parseFloat(sortedPrices[0])])
    sortedPrices.forEach((price: string) => {
      cumulativeVolume += rawOrderBook[side][price];
      formattedBook[side].push([cumulativeVolume, parseFloat(price)])
    })
  });
  return formattedBook
};

function getMinLowMaxHigh(ohlcData: OhlcData) {
  let ohlcPrices: Array<number> = []
  ohlcData.map((item: Array<number>) => ohlcPrices.push(item[2], item[3]));
  const minLow = Math.min(...ohlcPrices);
  const maxHigh = Math.max(...ohlcPrices);
  return [minLow, maxHigh]
};

function maxCumulativeVolume(book: OrderBookData) {
  let maxVolume = 0;
  if (Object.keys(book).length !== 0) {
    ['bids', 'asks'].forEach((side: string) => {
      book[side].forEach((item) => {
        if (item[0] > maxVolume) {
          maxVolume = item[0]
        }
      })
    });
  }
  return maxVolume
};

function getChartBoundaries(event: Highcharts.AxisSetExtremesEventObject, ohlcData: OhlcData, cumulativeOrderBook: any) {

  let bookPrices: Array<number> = [];
  ['bids', 'asks'].forEach((side: string) => cumulativeOrderBook[side].map((item: any[]) => bookPrices.push(item[0])))

  let ohlcPrices: Array<number> = []
  ohlcData.map((item: Array<number>) => (item[0] >= event.min && item[0] <= event.max) && ohlcPrices.push(item[2], item[3]));
  const minLow = Math.min(...ohlcPrices);
  const maxHigh = Math.max(...ohlcPrices);

  const lowerBoundary = Math.min(minLow);
  const upperBoundary = Math.max(maxHigh);
  return [lowerBoundary, upperBoundary];
};

function getSpread(bookData: OrderBookData) {
  let spread = 'N/A'
  if (Object.keys(bookData).length !== 0 && bookData.bids.length > 0 && bookData.asks.length > 0) {
    spread = ((bookData.asks[0][1] / bookData.bids[0][1] - 1) * 100).toFixed(2);
  };
  return spread
};

function OrderBookChart(props: BookChartProps) {
  const spread = getSpread(props.data);

  const options = {
    boost: {
      useGPUTranslations: true,
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
        min: 0,
        max: maxCumulativeVolume(props.data)
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
            [1, 'rgba(0, 0, 0, 0.5)']      // Adjust the color and opacity as needed
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
      height: chartsHeight - 80,
      panning: true,
      panKey: 'shift'
    },
    credits: { enabled: false },
  };
  return (
    Object.keys(props.data).length === 0 ?
      <div style={{ marginTop: '50%', marginLeft: '20%' }}>Error loading Order Book</div>
      :
      <div style={{ marginTop: '-15px' }}>
        <HighchartsReact
          highcharts={Highcharts}
          options={options}
        />
      </div>
  );
}

function OhlcChart(props: OhlcChartProps) {
  const selectedArticle = useSelector((state: { filters: FilterState }) => [state.filters.selectedArticle]);
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
        plotLines: [{
          color: 'white',
          width: 1,
          value: new Date(selectedArticle[0][0]),
          label: {
            text: selectedArticle[0][1],
            style: { color: 'white' }
          }
        }]
      },
    ],
    yAxis: [
      {
        labels: {
          align: 'left'
        },
        resize: {
          enabled: true
        },
        title: { text: '' },
        crosshair: {
          color: 'gray',
          dashStyle: 'solid',
          snap: false
        },
        lineWidth: 2,
        gridLineWidth: 0.2,
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
        data: props.data['ohlc'],
        name: props.pair,
        type: 'ohlc',
        yAxis: 0,
      },
      {
        data: volumeArray,
        name: 'volume',
        type: 'column',
        yAxis: 1,
        opacity: 0.5
      },
    ],
    chart: {
      backgroundColor: 'transparent',
      height: chartsHeight,
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
  const [exchange, pair] = useSelector((state: { filters: FilterState }) => [state.filters.exchange, state.filters.pair]);
  const [ohlcData, setOHLCData] = useState<OhlcData>([]);
  const [minLowMaxHigh, setMinLowMaxHigh] = useState<[number, number]>([0, 0])
  const [orderBookData, setOrderBookData] = useState<OrderBookData>({});
  const [publicTrades, setPublicTrades] = useState<Array<PublicTradeItem>>([]);
  const [chartBoundaries, setChartBoundaries] = useState<[number, number]>([0, 0]);
  const [isLoading, setIsLoading] = useState(true);
  const [synchCharts, setSynchCharts] = useState(true);

  // async function fetchOrderBookData(pair: string) {
  //   try {
  //     const orderBookResponse = await axios.get(
  //       `http://127.0.0.1:8000/order_book/?exchange=${exchange}&pair=${pair}`
  //     );
  //     const responseData = orderBookResponse.data;
  //     const data = setOrderBookBoundaries(responseData, minLowMaxHigh)
  //     setOrderBookData(data);
  //   } catch (error) {
  //     setOrderBookData(emptyOrderBook);
  //     console.error('Error fetching Order data:', error);
  //   }
  // };
  useEffect(() => {
    async function fetchOHLCData(pair: string) {
      try {
        const ohlc_response = await axios.get(
          `http://127.0.0.1:8000/ohlc/?exchange=${exchange}&pair=${pair}`
        );
        setOHLCData(ohlc_response.data);
      } catch (error) {
        setOHLCData([]);
        console.error('Error fetching OHLC data:', error);
      } finally {
        setIsLoading(false);
      };
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
    // fetchOrderBookData(pair);
    // setOrderBookData(emptyOrderBook);
    const wsUrl = `ws://localhost:8765?exchange=${exchange}&pair=${pair}`
    const socket = new WebSocket(wsUrl);
    socket.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      if (newData !== undefined && Object.keys(newData).includes('bids')) {
        setOrderBookData(formatOrderBook(newData))
      }
    };
    const ohlcInterval = setInterval(() => { fetchOHLCData(pair) }, 60000);
    const publicTradesInterval = setInterval(() => { fetchPublicTrades(pair) }, 60000);
    // const orderBookInterval = setInterval(() => { fetchOrderBookData(pair) }, 5000);
    fetchOHLCData(pair);
    fetchPublicTrades(pair);

    return () => {
      socket.close()
      // clearInterval(orderBookInterval)
      clearInterval(ohlcInterval)
      clearInterval(publicTradesInterval)
    }
  },
    [exchange, pair]);


  useEffect(() => {
    if (ohlcData.length !== 0 && synchCharts) {
      setMinLowMaxHigh(getMinLowMaxHigh(ohlcData) as [number, number]);
      setChartBoundaries([minLowMaxHigh[0], minLowMaxHigh[1]]);
    }
  },
    [exchange, pair, ohlcData, synchCharts]);

  // const orderBookChartData = buildCumulativeVolume(orderBookData, minLowMaxHigh);
  const ohlcChartData = { 'ohlc': ohlcData, 'publicTrades': publicTrades }

  const handleZoomChange = (event: Highcharts.AxisSetExtremesEventObject) => {
    if (synchCharts) {
      const boundaries = getChartBoundaries(event, ohlcData, orderBookData) as [number, number];
      if (
        (!(isNaN(boundaries[0])))
        && (!(isNaN(boundaries[1])))
        && (isFinite(boundaries[1]))
      ) {
        setChartBoundaries(boundaries)
      }
    }
  };
  const priceAxis = {
    labels: {
      align: 'left'
    },
    resize: {
      enabled: true
    },
    title: { text: '' },
    crosshair: {
      color: 'gray',
      dashStyle: 'solid',
      snap: false
    },
    lineWidth: 2,
    gridLineWidth: 0.2,
    min: synchCharts ? chartBoundaries[0] : null,
    max: synchCharts ? chartBoundaries[1] : null,
    event: {
      setExtremes: synchCharts ? handleZoomChange : null
    }
  };

  return (
    <div style={{ height: chartsHeight }}>
      {isLoading ?
        <Spinner animation="border" role="status" style={{ position: 'absolute', top: '30%', left: '35%' }}>
          < span className="visually-hidden" > Loading...</span >
        </Spinner >
        : null}
      {ohlcData.length !== 0 ?
        <Row style={{ height: chartsHeight }}>
          <Col sm={9} style={{ zIndex: 1 }}>
            <OhlcChart data={ohlcChartData} exchange={exchange} pair={pair} zoomHandler={handleZoomChange} priceAxis={priceAxis} />
          </Col>
          <Col sm={2} style={{ marginLeft: '-50px', zIndex: 2 }}>
            <FormControlLabel control={<Switch defaultChecked />} label="Synchrnoize with main chart" value={synchCharts} onChange={(e, checked) => setSynchCharts(checked)} />
            <OrderBookChart data={orderBookData} zoomHandler={handleZoomChange} priceAxis={priceAxis} synchCharts={synchCharts} />
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