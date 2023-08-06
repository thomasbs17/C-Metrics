import { useState } from "react"
import { ButtonGroup, Col, Container, Dropdown, Row, ToggleButton } from "react-bootstrap"
import { createStore, AnyAction } from 'redux';
import { Provider, useDispatch } from 'react-redux';
import { FilterState, filtersStore, initialState } from "../StateManagement";


type TradingTypes = {
    [key: string]: string;
};

type Exchanges = {
    [key: string]: string;
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

function ExchangeFilter() {
    const exchanges: Exchanges = { 'Coinbase': 'enabled', 'Kraken': 'disabled' };
    const [selectedValue, setSelectedValue] = useState(Object.keys(exchanges)[0]);
    const dispatch = useDispatch();

    const handleSelect = (exchange: string) => {
        setSelectedValue(exchange);
        dispatch({ type: 'SET_EXCHANGE', payload: exchange });
    };

    return (
        <Dropdown>
            <Dropdown.Toggle variant="success" id="exchange-dropdown">
                {selectedValue}
            </Dropdown.Toggle>
            <Dropdown.Menu>
                {Object.keys(exchanges).map((exchange) => (
                    <Dropdown.Item
                        key={exchange}
                        disabled={exchanges[exchange] === 'enabled' ? false : true}
                        onClick={() => handleSelect(exchange)}
                    >
                        {exchange}
                    </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    );
}

function CurrencyFilter() {
    const currencies: Array<string> = ['GBP', 'USD', 'EUR'];
    const [selectedValue, setSelectedValue] = useState(currencies[0]);
    const dispatch = useDispatch();

    const handleSelect = (currency: string) => {
        setSelectedValue(currency);
        dispatch({ type: 'SET_CURRENCY', payload: currency });
    };
    return (
        <Dropdown>
            <Dropdown.Toggle variant="success" id="currency-dropdown">
                {selectedValue}
            </Dropdown.Toggle>
            <Dropdown.Menu>
                {currencies.map((currency) => (
                    <Dropdown.Item
                        key={currency}
                        onClick={() => handleSelect(currency)}
                    >
                        {currency}
                    </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    )
}

function AssetFilter() {
    const assets: Array<string> = ['BTC', 'ETH', 'LTC'];
    const [selectedValue, setSelectedValue] = useState(assets[0]);
    const dispatch = useDispatch();

    const handleSelect = (asset: string) => {
        setSelectedValue(asset);
        dispatch({ type: 'SET_ASSET', payload: asset });
    };
    return (
        <Dropdown>
            <Dropdown.Toggle variant="success" id="asset-dropdown">
                {selectedValue}
            </Dropdown.Toggle>
            <Dropdown.Menu>
                {assets.map((asset) => (
                    <Dropdown.Item
                        key={asset}
                        onClick={() => handleSelect(asset)}
                    >
                        {asset}
                    </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    )
}

export function Filters() {
    return (

        <Container fluid style={{ display: 'flex', justifyContent: 'left' }}>
            <Row style={{ padding: '10px' }}>
                <Col>
                    <TradingTypeFilter />
                </Col>
                <Col>
                    <ExchangeFilter />
                </Col>
                <Col>
                    <CurrencyFilter />
                </Col>
                <Col>
                    <AssetFilter />
                </Col>
            </Row>
        </Container>
    )
}
