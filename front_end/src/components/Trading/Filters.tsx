import { useEffect, useRef, useState } from "react"
import { ButtonGroup, Col, Container, Dropdown, Row, Spinner, ToggleButton } from "react-bootstrap"
import { useDispatch, useSelector } from 'react-redux';
import { FilterState, filterSlice } from "../StateManagement";
import { Autocomplete, CircularProgress, TextField, ToggleButtonGroup } from "@mui/material";


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
            <ToggleButton value="paper">Paper Trading</ToggleButton>
            <ToggleButton disabled value="live">Live Trading</ToggleButton>
        </ToggleButtonGroup>
    )
}

function ExchangeFilter(props: FilterProps) {
    const dispatch = useDispatch();
    const [selectedValue, setSelectedValue] = useState('');
    const stateValue = useSelector((state: { filters: FilterState }) => state.filters.exchange);
    const handleSelect = (
        event: React.ChangeEvent<{}>,
        value: string | null,
    ) => {
        if (value !== null) {
            setSelectedValue(value)
            dispatch(filterSlice.actions.setExchange(value));
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
    const [selectedValue, setSelectedValue] = useState('');
    const [exchange, stateValue] = useSelector((state: { filters: FilterState }) => [state.filters.exchange, state.filters.pair]);
    const handleSelectPair = (
        event: React.ChangeEvent<{}>,
        value: string | null
    ) => {
        if (value !== null) {
            setSelectedValue(value);
            dispatch(filterSlice.actions.setPair(value));
        }
    };
    useEffect(() => {
        setSelectedValue(props.data[0])
        dispatch(filterSlice.actions.setPair(props.data[0]));
    }, [exchange, props.data, dispatch])

    return (
        <Autocomplete
            clearIcon={false}
            options={props.data}
            sx={{ width: 300 }}
            value={selectedValue != '' ? selectedValue : stateValue}
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

export function Filters() {
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
            </Row>
        </Container>
    );
}