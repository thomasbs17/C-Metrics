import HighchartsReact from 'highcharts-react-official';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FilterState } from '../StateManagement';
import axios from 'axios';
import Highcharts from 'highcharts/highstock'
import { Col, Row } from 'react-bootstrap';
import Lottie from 'lottie-react';
import HighchartsBoost from "highcharts/modules/boost";
import { Alert, CircularProgress, FormControlLabel, Switch, Typography } from '@mui/material';
import IndicatorsAll from 'highcharts/indicators/indicators-all';

IndicatorsAll(Highcharts);
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


function formatOrderBook(rawOrderBook: any, isWebSocketFeed: boolean) {
  let formattedBook: OrderBookData = { 'bids': [], 'asks': [] };
  ['bids', 'asks'].forEach((side: string) => {
    let cumulativeVolume = 0;
    if (isWebSocketFeed) {
      const sortedPrices = side === 'bids' ?
        Object.keys(rawOrderBook[side]).sort((a, b) => parseFloat(b) - parseFloat(a))
        : Object.keys(rawOrderBook[side]).sort((a, b) => parseFloat(a) - parseFloat(b));
      formattedBook[side].push([0, parseFloat(sortedPrices[0])])
      sortedPrices.forEach((price: string) => {
        cumulativeVolume += rawOrderBook[side][price];
        formattedBook[side].push([cumulativeVolume, parseFloat(price)])
      })
    } else {
      formattedBook[side].push([0, rawOrderBook[side][0][0]]);
      rawOrderBook[side].forEach((level: [number, number, number]) => {
        cumulativeVolume += level[1];
        formattedBook[side].push([cumulativeVolume, level[0]])
      })
    }
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

function getChartBoundaries(event: Highcharts.AxisSetExtremesEventObject, ohlcData: OhlcData) {
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
  const options = {
    boost: {
      useGPUTranslations: true,
    },
    tooltip: {
      enabled: true,
    },
    xAxis: [
      {
        type: 'linear',
        labels: { enabled: false, },
        crosshair: {
          color: 'gray',
          snap: false,
          width: 1,
          label: {
            enabled: true,
            formatter: function (value: number) {
              return value.toFixed(2);
            },
          }
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
      text: ``
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
      height: chartsHeight - 85,
      panning: true,
      panKey: 'shift'
    },
    credits: { enabled: false },
  };
  const bidAskFontSize = '13px'
  const spread = getSpread(props.data);
  const bid = props.data.bids[0][1].toLocaleString();
  const ask = props.data.asks[0][1].toLocaleString();
  return (
    <div style={{ marginTop: '10px', marginLeft: '-40px' }}>
      <Typography display={'flex'} justifyContent={'center'}>
        <span style={{ color: 'green', fontSize: bidAskFontSize }}>{`Bid: ${bid}`}</span>
        &nbsp;{'-'}&nbsp;
        <span style={{ fontSize: bidAskFontSize }}>{`Spread: ${spread}%`}</span>
        &nbsp;{'-'}&nbsp;
        <span style={{ color: 'red', fontSize: bidAskFontSize }}>{`Ask: ${ask}`}</span>
      </Typography>
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
      />
    </div>
  );
}

function OhlcChart(props: OhlcChartProps) {
  const selectedArticle = useSelector((state: { filters: FilterState }) => [state.filters.selectedArticle]);
  const volumeArray = props.data['ohlc'].map(item => [item[0], item[5]]);
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
          snap: false,
          label: {
            enabled: true,
            formatter: function (value: number) {
              return Highcharts.dateFormat('%Y-%m-%d', value);
            }
          }
        },
        opposite: false,
        plotLines: [{
          color: 'white',
          width: 1,
          value: new Date(selectedArticle[0][0]),
        }]
      },
    ],
    yAxis: [
      {
        labels: {
          enabled: false
        },
        resize: {
          enabled: true
        },
        title: { text: '' },
        crosshair: {
          color: 'gray',
          dashStyle: 'solid',
          snap: false,
          label: {
            enabled: true,
            formatter: function (value: number) {
              return value;
            },
          }
        },
        lineWidth: 2,
        gridLineWidth: 0.2,
      },
      {
        title: {
          text: ''
        },
        top: '80%',
        height: '20%',
        gridLineWidth: 0,
      }
    ],
    title: {
      text: ``
    },
    tooltip: {
      enabled: false,
    },
    series: [
      {
        data: props.data['ohlc'],
        name: props.pair,
        type: 'ohlc',
        yAxis: 0,
        id: 'ohlc'
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
  const [animationData, setAnimationData] = useState(null);
  const [ohlcFecthFailed, setOhlcFetchFailed] = useState(false);
  const [bookFecthFailed, setBookFetchFailed] = useState(false);

  useEffect(() => {
    async function fetchAnimationData() {
      const animationUrl = 'https://lottie.host/010ee17d-3884-424d-b64b-c38ed7236758/wy6OPJZDbJ.json';
      try {
        const response = await axios.get(animationUrl);
        setAnimationData(response.data);
      } catch (error) {
        console.error('Error fetching animation data:', error);
      }
    }
    fetchAnimationData();
  }, []);

  useEffect(() => {
    async function fetchOHLCData(pair: string) {
      try {
        const ohlc_response = await axios.get(
          `http://127.0.0.1:8000/ohlc/?exchange=${exchange}&pair=${pair}`
        );
        setOHLCData(ohlc_response.data);
        setOhlcFetchFailed(false)
      } catch (error) {
        setOHLCData([]);
        setOhlcFetchFailed(true)
        console.error('Error fetching OHLC data:', error);
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
    async function fetchOrderBookData(pair: string) {
      try {
        const orderBookResponse = await axios.get(
          `http://127.0.0.1:8000/order_book/?exchange=${exchange}&pair=${pair}`
        );
        const responseData = orderBookResponse.data;
        setOrderBookData(formatOrderBook(responseData, false))
        setBookFetchFailed(false);
      } catch (error) {
        setOrderBookData({});
        setBookFetchFailed(true);
        console.error('Error fetching Order Book data:', error);
      }
      finally {
        setIsLoading(false);
      };
    };
    const wsUrl = `ws://localhost:8765?exchange=${exchange}&pair=${pair}`
    const socket = new WebSocket(wsUrl);
    const orderBookInterval = setInterval(() => { fetchOrderBookData(pair) }, 5000);
    socket.onerror = () => {
      console.warn(`Could not implement websocket connection for ${pair} on ${exchange}. Will default back to periodic API refresh.`);
      fetchOrderBookData(pair);
      setSynchCharts(false)
    }
    socket.onopen = () => {
      clearInterval(orderBookInterval)
    }
    socket.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      if (newData !== undefined && Object.keys(newData).includes('bids')) {
        setOrderBookData(formatOrderBook(newData, true))
      }
    };
    const ohlcInterval = setInterval(() => { fetchOHLCData(pair) }, 60000);
    const publicTradesInterval = setInterval(() => { fetchPublicTrades(pair) }, 60000);
    fetchOHLCData(pair);
    fetchPublicTrades(pair);

    return () => {
      socket.close()
      clearInterval(orderBookInterval)
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
      const boundaries = getChartBoundaries(event, ohlcData) as [number, number];
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
      enabled: false,
    },
    resize: {
      enabled: true
    },
    title: { text: '' },
    crosshair: {
      color: 'gray',
      dashStyle: 'solid',
      snap: false,
      label: {
        enabled: false
      }
    },
    lineWidth: 2,
    gridLineWidth: 0,
    min: synchCharts ? chartBoundaries[0] : null,
    max: synchCharts ? chartBoundaries[1] : null,
    event: {
      setExtremes: synchCharts ? handleZoomChange : null
    }
  };

  return (
    <div style={{ height: chartsHeight }}>
      {isLoading ?
        <CircularProgress style={{ position: 'absolute', top: '30%', left: '40%' }} />
        :
        ohlcFecthFailed ?
          <Lottie animationData={animationData} style={{ height: chartsHeight }} />
          :
          <Row style={{ height: chartsHeight }}>
            <Col sm={10} style={{ zIndex: 1 }}>
              <OhlcChart data={ohlcChartData} exchange={exchange} pair={pair} zoomHandler={handleZoomChange} priceAxis={priceAxis} />
            </Col>
            <Col sm={2} style={{ zIndex: 2 }}>
              {bookFecthFailed ?
                <Alert style={{ marginTop: '50%', display: 'flex', justifyContent: 'center' }} severity="error">Error loading Order Book</Alert>
                :
                <>
                  <OrderBookChart data={orderBookData} zoomHandler={handleZoomChange} priceAxis={priceAxis} synchCharts={synchCharts} />
                  <FormControlLabel
                    style={{ marginLeft: '50px' }}
                    control={<Switch defaultChecked />}
                    label={<Typography fontSize={'10px'}>Synchrnoize with main chart</Typography>}
                    value={synchCharts}
                    onChange={(e, checked) => setSynchCharts(checked)} />
                </>
              }
            </Col>
          </Row>
      }
    </div>
  )
};
