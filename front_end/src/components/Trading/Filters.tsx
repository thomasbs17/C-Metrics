import { useEffect, useRef, useState } from "react"
import { Col, Container, Row, ToggleButton } from "react-bootstrap"
import { useDispatch, useSelector } from 'react-redux';
import { FilterState, filterSlice } from "../StateManagement";
import { Autocomplete, TextField, ToggleButtonGroup } from "@mui/material";
import axios from "axios";
import HighchartsReact from "highcharts-react-official";
import Highcharts from 'highcharts';
import HighchartsMore from 'highcharts/highcharts-more';
import SolidGauge from 'highcharts/modules/solid-gauge';
import { useNavigate } from 'react-router';

// Initialize the modules
HighchartsMore(Highcharts);
SolidGauge(Highcharts);

function LinearGauge(H: any) {
    H.seriesType('lineargauge', 'column', null, {
        setVisible: function () {
            H.seriesTypes.column.prototype.setVisible.apply(this, arguments);
            if (this.markLine) {
                this.markLine[this.visible ? 'show' : 'hide']();
            }
        },
        drawPoints: function () {
            // Draw the Column like always
            H.seriesTypes.column.prototype.drawPoints.apply(this, arguments);

            // Add a Marker
            var series = this,
                chart = this.chart,
                inverted = chart.inverted,
                xAxis = this.xAxis,
                yAxis = this.yAxis,
                point = this.points[0], // we know there is only 1 point
                markLine = this.markLine,
                ani = markLine ? 'animate' : 'attr';

            // Hide column
            point.graphic.hide();

            if (!markLine) {
                var path = inverted ? ['M', 0, 0, 'L', -5, -5, 'L', 5, -5, 'L', 0, 0, 'L', 0, 0 + xAxis.len] : ['M', 0, 0, 'L', -5, -5, 'L', -5, 5, 'L', 0, 0, 'L', xAxis.len, 0];
                markLine = this.markLine = chart.renderer.path(path)
                    .attr({
                        fill: series.color,
                        stroke: series.color,
                        'stroke-width': 1
                    }).add();
            }
            markLine[ani]({
                translateX: inverted ? xAxis.left + yAxis.translate(point.y) : xAxis.left,
                translateY: inverted ? xAxis.top : yAxis.top + yAxis.len - yAxis.translate(point.y)
            });
        }
    });
}

LinearGauge(Highcharts);

type FilterProps = {
    data: Array<string>
};

function TradingTypeFilter() {
    const [selectedValue, setSelectedValue] = useState("Paper");
    const dispatch = useDispatch();

    const handleSelect = (event: React.MouseEvent<HTMLElement>, tradingType: string) => {
        setSelectedValue(tradingType);
        dispatch({ type: 'SET_TRADING_TYPE', payload: tradingType });
    };
    return (

        <ToggleButtonGroup
            color="primary"
            style={{ padding: '10px' }}
            value={selectedValue}
            exclusive
            onChange={handleSelect}
            aria-label="Platform"
        >
            <ToggleButton value="paper" variant="success">Paper Trading</ToggleButton>
            <ToggleButton disabled value="live" variant="error">Live Trading</ToggleButton>
        </ToggleButtonGroup>
    )
}

function ExchangeFilter(props: FilterProps) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [selectedValue, setSelectedValue] = useState('');
    const stateValue = useSelector((state: { filters: FilterState }) => state.filters.exchange);
    const pair = useSelector((state: { filters: FilterState }) => state.filters.pair);
    const handleSelect = (
        event: React.ChangeEvent<{}>,
        value: string | null,
    ) => {
        if (value !== null) {
            setSelectedValue(value)
            dispatch(filterSlice.actions.setExchange(value));
            navigate(`/trading?exchange=${value}&pair=${pair}`)
        }
    };
    return (
        <Autocomplete
            clearIcon={false}
            options={props.data}
            sx={{ width: 300 }}
            value={selectedValue != '' ? selectedValue : stateValue}
            onChange={handleSelect}
            renderInput={(params) => <TextField {...params} label={`Exchange (${props.data.length})`} />}
        />
    );
}

function PairFilter(props: FilterProps) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [exchange, stateValue] = useSelector((state: { filters: FilterState }) => [state.filters.exchange, state.filters.pair]);
    const [selectedValue, setSelectedValue] = useState(stateValue);
    const handleSelectPair = (
        event: React.ChangeEvent<{}>,
        value: string | null
    ) => {
        if (value !== null) {
            setSelectedValue(value);
            dispatch(filterSlice.actions.setPair(value));
            navigate(`/trading?exchange=${exchange}&pair=${value}`)
        }
    };
    useEffect(() => {
        setSelectedValue(stateValue);
        navigate(`/trading?exchange=${exchange}&pair=${stateValue}`)
    }, [stateValue, exchange, props.data])

    return (
        <Autocomplete
            clearIcon={false}
            options={props.data}
            sx={{ width: 300 }}
            value={selectedValue !== '' ? selectedValue : stateValue}
            onChange={handleSelectPair}
            renderInput={(params) => <TextField {...params} label={`Pair (${props.data.length})`} />}
        />
    )
};

function LoadExchanges() {
    const [exchanges, setExchanges] = useState<Array<string>>([]);
    useEffect(() => {
        async function getExchangesData() {
            try {
                const response = await fetch('http://127.0.0.1:8000/exchanges/');
                const data = await response.json();
                if (data.length > 0) {
                    setExchanges(data);
                }
            } catch (error) {
                console.error('Error fetching exchanges:', error);
            }
        }
        getExchangesData();
    }, []);
    return exchanges;
}

function LoadMarkets(exchange: string) {
    const [markets, setMarkets] = useState({});
    useEffect(() => {
        async function getMarketsData() {
            try {
                const response = await fetch(`http://127.0.0.1:8000/markets/?exchange=${exchange}`);
                const data = await response.json();
                setMarkets(data);
            } catch (error) {
                setMarkets({});
                console.error('Error fetching markets:', error);
            }
        }
        getMarketsData();
    }, [exchange]);
    return markets;
};

function filtersSideAnimation(containerRef: React.RefObject<HTMLDivElement>, markets: any) {
    const container = containerRef.current;
    if (container && Object.keys(markets).length != 0) {
        container.style.opacity = '1';
        container.style.transform = 'translateX(0)';
    };
};

const containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'left',
    transform: 'translateX(-50px)',
    opacity: '0',
    transition: 'opacity 1s, transform 1s',
    zIndex: 2,
    position: 'relative'
};


function GreedAndFear() {
    const [data, setData] = useState<any>({});
    useEffect(() => {
        async function fetchIndexData() {
            const url = "https://api.alternative.me/fng/";
            try {
                const response = await axios.get(url);
                setData(response.data);
            } catch (error) {
                console.error('Error fetching greed and fear index data:', error);
            }
        }
        fetchIndexData();
    }, []);
    const options = {
        credits: { enabled: false },
        chart: {
            inverted: true,
            backgroundColor: 'transparent',
            height: 100,
            width: 250,
        },
        title: {
            text: "Greed & Fear",
            verticalAlign: 'bottom',
            y: 0
        },
        xAxis: {
            labels: {
                enabled: false
            },
            tickLength: true
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
                }, {
                    from: 25,
                    to: 44,
                    color: '#FF0000',
                },
                {
                    from: 45,
                    to: 55,
                    color: 'orange',
                }, {
                    from: 56,
                    to: 75,
                    color: '#008000',
                }, {
                    from: 76,
                    to: 100,
                    color: '#006400',
                }
            ]
        },
        legend: {
            enabled: false
        },
        tooltip: {enabled: false},
        series: [
            {
                type: "lineargauge",
                data: Object.keys(data).length !== 0 ? [parseInt(data["data"][0]["value"])] : [],
                color: "white",
                dataLabels: {
                    enabled: true,
                    align: "center",
                    verticalAlign: 'bottom',
                    y: 2,
                    style: {
                      fontSize: 12,
                    },
                    format: Object.keys(data).length !== 0 ? `{y} (${data["data"][0]["value_classification"]})` : null
                },
            }
        ] as any
    };
    return (
        <div style={{ position: 'absolute', overflow: 'visible' }}>
            {Object.keys(data).length !== 0 &&
                <HighchartsReact
                    highcharts={Highcharts}
                    options={options}
                    type="lineargauge"
                />
            }
        </div>
    )
};

export function TopBar() {
    const exchange = useSelector((state: { filters: FilterState }) => state.filters.exchange);
    const containerRef = useRef<HTMLDivElement>(null);
    const markets = LoadMarkets(exchange);
    const exchanges = LoadExchanges();
    useEffect(() => {
        filtersSideAnimation(containerRef, markets)
    });

    return (
        <Container fluid ref={containerRef} style={containerStyle}>
            <Row style={{ padding: '10px' }}>
                <Col>
                    <TradingTypeFilter />
                </Col>
                <Col>
                    <ExchangeFilter data={exchanges} />
                </Col>
                {Object.keys(markets).length != 0 &&
                    <Col>
                        <PairFilter data={Object.keys(markets).sort()} />
                    </Col>
                }
                <Col style={{ width: 320 }}>
                    <GreedAndFear />
                </Col>
            </Row>
        </Container>
    );
}