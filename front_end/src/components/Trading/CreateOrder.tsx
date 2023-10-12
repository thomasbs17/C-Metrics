import { Alert, Button, CircularProgress, FormControlLabel, Radio, RadioGroup, Snackbar, TextField } from '@mui/material';
import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import { Col, Container, Row, Stack } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { FilterState, filterSlice } from '../StateManagement';

type OrderTypeSideProps = {
    handleOrderSideChange: (radio: string) => void;
};

type OrderTypeFilterProps = {
    handleOrderTypeChange: (radio: string) => void;
};


function OrderSideFilter({ handleOrderSideChange }: OrderTypeSideProps) {
    return (
        <RadioGroup row defaultValue="buy">
            <FormControlLabel value="buy" control={<Radio />} label="Buy" onChange={() => handleOrderSideChange('buy')} />
            <FormControlLabel value="sell" control={<Radio />} label="Sell" onChange={() => handleOrderSideChange('sell')} />
        </RadioGroup>
    );
}

function OrderTypeFilter({ handleOrderTypeChange }: OrderTypeFilterProps) {
    return (
        <RadioGroup row defaultValue="limit">
            <FormControlLabel value="limit" control={<Radio />} label="Limit" onChange={() => handleOrderTypeChange('limit')} />
            <FormControlLabel value="market" control={<Radio />} label="Market" onChange={() => handleOrderTypeChange('market')} />
        </RadioGroup>

    );
};

function OrderDetails() {
    const dispatch = useDispatch();
    const [exchange, pair] = useSelector((state: { filters: FilterState }) => [state.filters.exchange, state.filters.pair]);
    const [selectedOrderSide, setSelectedOrderSide] = useState<string>('buy');
    const [selectedOrderType, setSelectedOrderType] = useState<string>('limit');
    const [orderAmount, setOrderAmount] = useState<number | null>(null);
    const [orderLimitPrice, setOrderLimitPrice] = useState<number | null>(null);
    const [snackIsOpen, setSnackIsOpen] = useState<boolean>(false);
    const [isLoading, seIsLoading] = useState<boolean>(false);

    const handleOrderSideChange = (radio: string) => {
        setSelectedOrderSide(radio);
    };

    const handleOrderTypeChange = (radio: string) => {
        setSelectedOrderType(radio);
    };

    function SubmitOrder() {
        seIsLoading(true);
        const endpoint = 'http://127.0.0.1:8000/new_order/';

        const orderData = {
            user_id: 'thomasbouamoud',
            broker_id: exchange,
            trading_env: 'paper_trading',
            trading_type: 'spot',
            asset_id: pair,
            order_side: selectedOrderSide,
            order_type: selectedOrderType,
            order_creation_tmstmp: Date.now(),
            order_status: selectedOrderType === 'limit' ? 'open' : 'executed',
            fill_pct: selectedOrderType === 'limit' ? 0 : 1,
            order_volume: orderAmount,
            order_price: orderLimitPrice === undefined ? null : orderLimitPrice
        };

        axios.post(endpoint, orderData)
            .then((response) => {
                console.log('Response:', response.data);
                seIsLoading(false);
            })
            .catch((error) => {
                seIsLoading(false);
                console.error('Error:', error);
            });
        setOrderAmount(null);
        setOrderLimitPrice(null);
        setSnackIsOpen(true);
        dispatch(filterSlice.actions.setOrdersNeedReload(true))
    };
    return (
        <Container>
            <Row style={{ marginLeft: '10%' }}>
                <Col>
                    <OrderSideFilter handleOrderSideChange={handleOrderSideChange} />
                </Col>
                <Col >
                    <OrderTypeFilter handleOrderTypeChange={handleOrderTypeChange} />
                </Col>
            </Row>
            <Row style={{ paddingTop: 20 }}>
                {selectedOrderType === 'limit' &&
                    <Col>
                        <TextField
                            id="limit-price"
                            label="Limit Price"
                            type="number"
                            value={orderLimitPrice === null ? '' : orderLimitPrice}
                            onChange={(event) => setOrderLimitPrice(event.target.value === '' ? null : parseFloat(event.target.value))}
                            sx={{ width: '100%' }}
                        />
                    </Col>
                }
                <Col>
                    <TextField
                        id="order-amount"
                        label="Amount"
                        type="number"
                        value={orderAmount}
                        onChange={(event) => setOrderAmount(event.target.value === '' ? null : parseFloat(event.target.value))}
                        sx={{ width: '100%' }}
                    />
                </Col>
            </Row>
            <Row style={{ paddingTop: 20 }}>
                {isLoading ?
                    <CircularProgress style={{ marginLeft: '50%' }} />
                    :
                    <Button
                        variant="contained"
                        color={selectedOrderSide === 'buy' ? 'success' : 'error'}
                        disabled={orderAmount === null || (selectedOrderType === "limit" && orderLimitPrice === null) ? true : false}
                        onClick={() =>
                            SubmitOrder()
                        }
                        sx={{ width: '100%' }}>
                        {selectedOrderSide}
                    </Button>
                }
            </Row>
            <Snackbar open={snackIsOpen} autoHideDuration={2000} onClose={() => setSnackIsOpen(false)}>
                <Alert severity="success" sx={{ width: '100%' }}>
                    Order successfuly created!
                </Alert>
            </Snackbar>
        </Container>
    );

}

function CreateOrderWidget() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        }
    }, []);

    const containerStyle: React.CSSProperties = {
        opacity: 0,
        transform: 'translateY(-50px)',
        transition: 'opacity 1s, transform 1s',
        height: '200px',
        padding: 5
    };

    return (
        <Stack style={containerStyle} ref={containerRef}>
            <OrderDetails />
        </Stack>
    );

}

export default CreateOrderWidget;
