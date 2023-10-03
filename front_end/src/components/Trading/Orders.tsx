import { Checkbox, CircularProgress, FormControlLabel, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { FilterState, Order, filterSlice } from '../StateManagement';
import axios from 'axios';



interface TableProps {
    openOnly: boolean,
    selectedPair: boolean,
    paper: boolean,
    live: boolean
}

function formatTimeStamp(originalDate: any) {
    let formattedDate = originalDate.substring(0, 19);
    formattedDate = formattedDate.replace('T', ' ');
    return formattedDate
}

function OrderTable({ openOnly, selectedPair, paper, live }: TableProps) {
    const dispatch = useDispatch();
    const pair = useSelector((state: { filters: FilterState }) => state.filters.pair);
    const ordersNeedReload = useSelector((state: { filters: FilterState }) => state.filters.ordersNeedReload);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true)

    function getFilteredOrders() {
        let filteredOrders = orders.filter((order: Order) => {
            const isOpen = openOnly ? order.order_status === "open" : true;
            const isMatchingPair = selectedPair ? order.asset_id === pair : true;
            const isPaperTrading = paper ? order.trading_env === "paper_trading" : false;
            const isLiveTrading = live ? order.trading_env === "live" : false;
            return isOpen && isMatchingPair && (isPaperTrading || isLiveTrading);
        });
        filteredOrders = filteredOrders.sort((
            a: { order_creation_tmstmp: string | number | Date; },
            b: { order_creation_tmstmp: string | number | Date; }) =>
            new Date(b.order_creation_tmstmp).getTime() - new Date(a.order_creation_tmstmp).getTime());
        return filteredOrders
    }

    useEffect(() => {
        async function fetchOrders() {
            const ordersEndPoint = 'http://127.0.0.1:8000/orders/?format=json';
            try {
                const response = await axios.get(ordersEndPoint);
                setOrders(response.data);
                dispatch(filterSlice.actions.setOrdersNeedReload(false));
                setIsLoading(false);
            } catch (error) {
                console.error('Error fetching orders data:', error);
            }
        };
        if (ordersNeedReload) {
            fetchOrders();
        }
    }, [dispatch, ordersNeedReload]);

    const filteredOrders = getFilteredOrders();

    return (

        isLoading ?
            <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
            :
            <TableContainer sx={{ maxHeight: 170 }}>
                <Table stickyHeader size='small'>
                    <TableHead >
                        <TableRow >
                            <TableCell align="left" ><u>Creation Date</u></TableCell>
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
                                <TableCell align="left" sx={{color: order.order_side === 'buy' ? 'green' : 'red', fontSize: 12}}>{formatTimeStamp(order.order_creation_tmstmp)}</TableCell>
                                <TableCell align="left" sx={{color: order.order_side === 'buy' ? 'green' : 'red'}}>{order.trading_env}</TableCell>
                                <TableCell align="left" sx={{color: order.order_side === 'buy' ? 'green' : 'red'}}>{order.asset_id}</TableCell>
                                <TableCell align="left" sx={{color: order.order_side === 'buy' ? 'green' : 'red'}}>{order.order_side}</TableCell>
                                <TableCell align="left" sx={{color: order.order_side === 'buy' ? 'green' : 'red'}}>{order.order_type}</TableCell>
                                <TableCell align="left" sx={{color: order.order_side === 'buy' ? 'green' : 'red'}}>{order.order_status}</TableCell>
                                <TableCell align="left" sx={{color: order.order_side === 'buy' ? 'green' : 'red'}}>{order.fill_pct * 100}%</TableCell>
                                <TableCell align="left" sx={{color: order.order_side === 'buy' ? 'green' : 'red'}}>{order.order_volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell align="left" sx={{color: order.order_side === 'buy' ? 'green' : 'red'}}>{order.order_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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