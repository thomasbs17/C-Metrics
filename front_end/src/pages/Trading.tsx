import { Col, Container, Row } from 'react-bootstrap';
import TradeHistory from '../components/Trading/TradeHistory';
import Screening from '../components/Trading/Screening';
import CreateOrderWidget from '../components/Trading/CreateOrder';
import News from '../components/Trading/News';
import { Provider, useDispatch } from 'react-redux';
import { TradingChart } from '../components/Trading/Chart';
import Orders from '../components/Trading/Orders';
import Holdings from '../components/Trading/Holdings';
import { filterSlice, filtersStore } from '../components/StateManagement';
import { Box, Tab, Tabs } from '@mui/material';
import React from 'react';
import { TopBar } from '../components/Trading/Filters';

function BottomLeftContainer() {
    const dispatch = useDispatch();
    const [value, setValue] = React.useState('orders');

    const handleChange = (event: React.SyntheticEvent, newValue: string) => {
        setValue(newValue);
        dispatch(filterSlice.actions.setOrdersNeedReload(true));
    };
    return (
        <div className="border border-primary rounded-3 p-3" style={{ height: '280px' }}>
            <Box sx={{ width: '100%' }}>
                <Tabs
                    value={value}
                    onChange={handleChange}
                    aria-label="bottom-left-tab"
                    variant="fullWidth"
                >
                    <Tab value="orders" label="Orders" />
                    <Tab value="holdings" label="Holdings" />
                    <Tab value="trade-history" label="Trade History" />
                    <Tab value="create-order" label="Create Order" />
                </Tabs>
                {
                    value === "orders" && <Orders />
                }
                {
                    value === "holdings" && <Holdings />
                }
                {
                    value === "trade-history" && <TradeHistory />
                }
                {
                    value === "create-order" && <CreateOrderWidget />
                }
            </Box>
        </div>
    )
}

function BottomRightContainer() {
    const [value, setValue] = React.useState('news');

    const handleChange = (event: React.SyntheticEvent, newValue: string) => {
        setValue(newValue);
    };
    return (
        <div className="border border-primary rounded-3 p-3" style={{ height: '280px', overflowY: 'hidden' }}>
            <Box sx={{ width: '100%' }}>
                <Tabs
                    value={value}
                    onChange={handleChange}
                    aria-label="bottom-right-tab"
                    variant="fullWidth"
                >
                    <Tab value="news" label="News" sx={{ height: '30px' }} />
                    <Tab value="screening" label="Screening" />
                </Tabs>
                {
                    value === "news" && <News />
                }
                {
                    value === "screening" && <Screening />
                }

            </Box>
        </div>
    )
}


function Trading() {
    return (
        <Provider store={filtersStore}>
            <TopBar />
            <Container fluid>
                <TradingChart />
                <Row>
                    <Col style={{maxWidth: '50%'}}>
                        <BottomLeftContainer />
                    </Col>
                    <Col style={{maxWidth: '50%'}}>
                        <BottomRightContainer />
                    </Col>
                </Row>
            </Container>
        </Provider>
    );
}

export default Trading;