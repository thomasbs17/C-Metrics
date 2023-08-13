import { useEffect, useRef, useState } from "react"
import { ButtonGroup, Col, Container, Dropdown, Row, Spinner, ToggleButton } from "react-bootstrap"
import { createStore, AnyAction } from 'redux';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { FilterState, filtersStore, initialState } from "../StateManagement";


type TradingTypes = {
    [key: string]: string;
};

interface ExchangeFilterProps {
    data: string[]; // Define the prop type as an array of strings
}

interface MarketsFilterProps {
    data: {
        assets: string[];
        currencies: string[];
    };
}

type PairDetails = {
    id: string;
    symbol: string;
    base: string;
    quote: string;
    baseId: string;
    quoteId: string;
    active: boolean;
    type: string;
    linear: any | null; // Adjust this type accordingly
    inverse: any | null; // Adjust this type accordingly
    spot: boolean;
    swap: boolean;
    future: boolean;
    option: boolean;
    margin: boolean;
    contract: boolean;
    contractSize: any | null; // Adjust this type accordingly
    expiry: any | null; // Adjust this type accordingly
    expiryDatetime: any | null; // Adjust this type accordingly
    optionType: any | null; // Adjust this type accordingly
    strike: any | null; // Adjust this type accordingly
    settle: any | null; // Adjust this type accordingly
    settleId: any | null; // Adjust this type accordingly
    precision: {
        amount: number;
        price: number;
    };
    limits: {
        amount: {
            min: any | null; // Adjust this type accordingly
            max: any | null; // Adjust this type accordingly
        };
        price: {
            min: any | null; // Adjust this type accordingly
            max: any | null; // Adjust this type accordingly
        };
        cost: {
            min: number | null;
            max: any | null; // Adjust this type accordingly
        };
        leverage: {
            min: any | null; // Adjust this type accordingly
            max: any | null; // Adjust this type accordingly
        };
    };
    info: {
        id: string;
        base_currency: string;
        quote_currency: string;
        quote_increment: string;
        base_increment: string;
        display_name: string;
        min_market_funds: string;
        margin_enabled: boolean;
        post_only: boolean;
        limit_only: boolean;
        cancel_only: boolean;
        status: string;
        status_message: string;
        trading_disabled: boolean;
        fx_stablecoin: boolean;
        max_slippage_percentage: string;
        auction_mode: boolean;
        high_bid_limit_percentage: string;
    };
    percentage: boolean;
    tierBased: boolean;
    maker: number;
    taker: number;
}

type MarketData = {
    [key: string]: PairDetails;
};


function TradingTypeFilter() {
    const tradingTypes: TradingTypes = { 'Paper Trading': 'enabled', 'Live Trading': 'disabled' }
    const [selectedValue, setSelectedValue] = useState(Object.keys(tradingTypes)[0]);
    const dispatch = useDispatch();

    const handleSelect = (tradingType: string) => {
        setSelectedValue(tradingType);
        dispatch({ type: 'SET_TRADING_TYPE', payload: tradingType });
    };
    return (
        <ButtonGroup style={{ width: '250px' }}>
            {Object.keys(tradingTypes).map((tradingType) => (
                <ToggleButton
                    type="radio"
                    value={tradingType}
                    checked={selectedValue === tradingType}
                    onClick={() => handleSelect(tradingType)}
                    disabled={tradingTypes[tradingType] === 'enabled' ? false : true}
                >
                    {tradingType}
                </ToggleButton>
            ))}
        </ButtonGroup>
    )
}

function ExchangeFilter(props: ExchangeFilterProps) {
    const [selectedValue, setSelectedValue] = useState('coinbasepro');
    const dispatch = useDispatch();
    const handleSelect = (exchange: string) => {
        setSelectedValue(exchange);
        dispatch({ type: 'SET_EXCHANGE', payload: exchange });
    };
    return (
        <Dropdown>
            <Dropdown.Toggle variant="success" id="exchange-dropdown">
                {props.data.length != 0 ? selectedValue : "Loading..."}
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ height: '300px', overflowY: 'scroll' }}>
                {props.data.map((exchange) => (
                    <Dropdown.Item
                        key={exchange}
                        onClick={() => handleSelect(exchange)}
                        id={`${exchange}_filter`}
                    >
                        {exchange}
                    </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    );
}

function CurrencyFilter(props: MarketsFilterProps) {
    const { tradingType, exchange, currency, asset } = useSelector((state: FilterState) => state);
    const dispatch = useDispatch();
    const [selectedCurrency, setSelectedCurrency] = useState(props.data.currencies[0]);

    const handleSelectCurrency = (currency: string) => {
        setSelectedCurrency(currency);
        dispatch({ type: 'SET_CURRENCY', payload: currency });
    };

    useEffect(() => {
        handleSelectCurrency(props.data.currencies[0])
    }, [exchange])

    return (
        <Dropdown>
            <Dropdown.Toggle variant="success" id="currency-dropdown">
                {selectedCurrency}
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ height: '300px', overflowY: 'scroll' }}>
                {props.data.currencies.map((currency) => (
                    <Dropdown.Item
                        key={currency}
                        onClick={() => handleSelectCurrency(currency)}
                        id={`${currency}_filter`}
                    >
                        {currency}
                    </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>

    )
};

function AssetsFilter(props: MarketsFilterProps) {
    const dispatch = useDispatch();

    const [selectedAsset, setSelectedAsset] = useState(props.data.assets[0]);

    const handleSelectAsset = (asset: string) => {
        setSelectedAsset(asset);
        dispatch({ type: 'SET_ASSET', payload: asset });
    };

    return (
        <Dropdown>
            <Dropdown.Toggle variant="success" id="asset-dropdown">
                {selectedAsset}
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ height: '300px', overflowY: 'scroll' }}>
                {props.data.assets.map((asset) => (
                    <Dropdown.Item
                        key={asset}
                        onClick={() => handleSelectAsset(asset)}
                        id={`${asset}_filter`}
                    >
                        {asset}
                    </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    )

}

function GetCurrenciesAndAssets(markets: MarketData) {
    const { tradingType, exchange, currency, asset } = useSelector((state: FilterState) => state);
    let currencies: Array<string> = [];
    let assets: Array<string> = [];
    for (const pair in markets) {
        if (!(currencies.includes(markets[pair]['quote']))) {
            currencies.push(markets[pair]['quote']);
        }
    }
    for (const pair in markets) {
        if (!(assets.includes(markets[pair]['base'])) && (markets[pair]['quote'] === currency)) {
            assets.push(markets[pair]['base'])
        }
    };
    return { 'currencies': currencies.sort(), 'assets': assets.sort() }
}


function LoadExchanges() {
    const [exchanges, setExchanges] = useState<string[]>([]);
    useEffect(() => {
        async function getExchangesData() {
            try {
                const response = await fetch('http://localhost:8000/exchanges/');
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
    const [markets, setMarkets] = useState<MarketData>({});
    useEffect(() => {
        async function getMarketsData() {
            try {
                const response = await fetch(`http://localhost:8000/markets/?exchange=${exchange}`);
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
}

export function Filters() {
    const { tradingType, exchange, currency, asset } = useSelector((state: FilterState) => state);

    const containerRef = useRef<HTMLDivElement>(null);
    const exchanges = LoadExchanges();
    const markets = LoadMarkets(exchange);
    const currenciesAndAssets = GetCurrenciesAndAssets(markets);

    useEffect(() => {
        const container = containerRef.current;
        if (container && Object.keys(markets).length != 0) {
            container.style.opacity = '1';
            container.style.transform = 'translateX(0)';
        };
    }, );

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'left',
        transform: 'translateX(-50px)',
        opacity: '0',
        transition: 'opacity 1s, transform 1s',
        zIndex: 2,
        position: 'relative'
    };

    return (
        <Container fluid ref={containerRef} style={containerStyle}>
            <Row style={{ padding: '10px' }}>
                {exchanges.length === 0 ?
                    <Spinner></Spinner>
                    :
                    <>
                        <Col>
                            <TradingTypeFilter />
                        </Col>
                        <Col>
                            <ExchangeFilter data={exchanges} />
                        </Col>
                        {Object.keys(markets).length === 0 ?
                            null
                            :
                            <>
                                <Col>
                                    <CurrencyFilter data={currenciesAndAssets} />
                                </Col>
                                <Col>
                                    <AssetsFilter data={currenciesAndAssets} />
                                </Col>
                            </>
                        }
                    </>
                }
            </Row>
        </Container>
    );
}