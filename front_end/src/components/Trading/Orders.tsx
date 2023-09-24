import { Checkbox, CircularProgress, FormControlLabel, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { FilterState, filterSlice } from '../StateManagement';
import axios from 'axios';

type Order = {
    user_id: string;
    order_id: string;
    broker_id: string;
    trading_env: string;
    trading_type: string;
    asset_id: string;
    order_side: string;
    order_type: string;
    order_creation_tmstmp: string; // You might want to use a Date type if applicable
    order_status: string;
    fill_pct: number;
    order_volume: number;
    order_price: number;
}

interface TableProps {
    openOnly: boolean,
    selectedPair: boolean,
    paper: boolean,
    live: boolean
}

function LoadOrders() {
    const [orders, setOrders] = useState<Array<Order>>([]);
    useEffect(() => {
        async function fetchOrders() {
            const ordersEndPoint = 'http://127.0.0.1:8000/orders/?format=json';
            try {
                const response = await axios.get(ordersEndPoint);
                setOrders(response.data);
            } catch (error) {
                console.error('Error fetching orders data:', error);
            }
        }
        fetchOrders();
    }, []);
    return orders
};



function OrderTable({ openOnly, selectedPair, paper, live }: TableProps) {
    const dispatch = useDispatch();
    const pair = useSelector((state: { filters: FilterState }) => state.filters.pair);
    const orders = LoadOrders();

    let filteredOrders = orders.filter((order) => {
        const isOpen = openOnly ? order.order_status === "open" : true;
        const isMatchingPair = selectedPair ? order.asset_id === pair : true;
        const isPaperTrading = paper ? order.trading_env === "paper_trading" : false;
        const isLiveTrading = live ? order.trading_env === "live" : false;

        console.log(isLiveTrading)
        // console.log(isPaperTrading)

        return isOpen && isMatchingPair && (isPaperTrading || isLiveTrading);
    });
    filteredOrders = filteredOrders.sort((a, b) => new Date(b.order_creation_tmstmp).getTime() - new Date(a.order_creation_tmstmp).getTime());

    return (
        orders.length === 0 ?
            <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
            :
            <TableContainer sx={{ maxHeight: 180 }}>
                <Table stickyHeader size='small'>
                    <TableHead >
                        <TableRow >
                            <TableCell align="left" ><u>Date</u></TableCell>
                            <TableCell align="left" ><u>Environment</u></TableCell>
                            <TableCell align="left" ><u>Asset</u></TableCell>
                            <TableCell align="left" ><u>Side</u></TableCell>
                            <TableCell align="left" ><u>Type</u></TableCell>
                            <TableCell align="left" ><u>Status</u></TableCell>
                            <TableCell align="left" ><u>Fill %</u></TableCell>
                            <TableCell align="left" ><u>Volume</u></TableCell>
                            <TableCell align="left" ><u>Price</u></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredOrders.map((order: Order, index: number) => (
                            <TableRow
                                key={index}
                                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                hover
                                onMouseEnter={() => dispatch(filterSlice.actions.setSelectedOrder([order.order_creation_tmstmp, order.order_price]))}
                                onMouseLeave={() => dispatch(filterSlice.actions.setSelectedOrder(['', '']))}
                            >
                                <TableCell align="left">{order.order_creation_tmstmp}</TableCell>
                                <TableCell align="left" >{order.trading_env}</TableCell>
                                <TableCell align="left" >{order.asset_id}</TableCell>
                                <TableCell align="left" >{order.order_side}</TableCell>
                                <TableCell align="left" >{order.order_type}</TableCell>
                                <TableCell align="left" >{order.order_status}</TableCell>
                                <TableCell align="left" >{order.fill_pct * 100}%</TableCell>
                                <TableCell align="left" >{order.order_volume}</TableCell>
                                <TableCell align="left" >{order.order_price}</TableCell>
                            </TableRow>
                        ))
                        }
                    </TableBody>
                </Table>
            </TableContainer>
    );
}

function Orders() {
    const [openOnly, setOpenOnly] = useState(true);
    const [selectedPair, setSelectedPair] = useState(true);
    const [paper, setPaper] = useState(true);
    const [live, setLive] = useState(false);
    return (
        <Container>
            <div style={{ zIndex: 1000, position: 'relative' }}>
                <Row>
                    <Col xs={3}>
                        <FormControlLabel control={<Switch checked={openOnly} onChange={() => setOpenOnly(!openOnly)} />} label="Open orders only" />
                    </Col>
                    <Col xs={3}>
                        <FormControlLabel control={<Switch checked={selectedPair} onChange={() => setSelectedPair(!selectedPair)} />} label="Selected pair only" />
                    </Col>
                    <Col xs={5}>
                        <FormControlLabel control={<Checkbox checked={paper} onChange={() => setPaper(!paper)} />} label="Paper Trading" />
                        <FormControlLabel control={<Checkbox checked={live} onChange={() => setLive(!live)} />} label="Live Trading" />
                    </Col>
                </Row >
            </div>
            <OrderTable
                openOnly={openOnly}
                selectedPair={selectedPair}
                paper={paper}
                live={live}
            />
        </Container >
    )
}

export default Orders;