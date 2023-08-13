import { Accordion, Col, Container, Dropdown, Placeholder, Row, Stack, Tab, Tabs } from 'react-bootstrap';
import TradeHistory from '../components/Trading/TradeHistory';
import Screening from '../components/Trading/Screening';
import CreateOrderWidget from '../components/Trading/CreateOrder';
import News from '../components/Trading/News';
import { Filters } from '../components/Trading/Filters';
import { Provider } from 'react-redux';
import { filtersStore } from '../components/StateManagement';
import { TradingChart } from '../components/Trading/Chart';
import OpenOrders from '../components/Trading/OpenOrders';
import Holdings from '../components/Trading/Holdings';


function BottomLeftContainer() {
    return (
        <div className="border border-primary rounded-3 p-3" style={{ height: '300px' }}>
            <Tabs
                defaultActiveKey="open-orders"
                className="sm-3"
                fill
            >
                <Tab eventKey="open-orders" title="Open Orders">
                    <OpenOrders />
                </Tab>
                <Tab eventKey="holdings" title="Holdings">
                    <Holdings />
                </Tab>
                <Tab eventKey="trade-history" title="Trade History">
                    <TradeHistory />
                </Tab>
            </Tabs>
        </div>
    )
}

function BottomRightContainer() {
    return (
        <div className="border border-primary rounded-3 p-3" style={{ height: '300px', overflowY: 'scroll' }}>
            <Tabs
                defaultActiveKey="news"
                className="sm-3"
                fill
            >
                <Tab eventKey="news" title="News">
                    <News />
                </Tab>
                <Tab eventKey="screening" title="Screening">
                    <Screening />
                </Tab>
            </Tabs>
        </div>
    )
}


function Trading() {
    return (
        <div>
            <Provider store={filtersStore}>
                <Filters />
                <Container fluid>
                    <TradingChart />
                    <Row>
                        <Col>
                            <BottomLeftContainer />
                        </Col>
                        <Col>
                            <BottomRightContainer />
                        </Col>
                    </Row>
                </Container>
            </Provider>
        </div>
    );
}

export default Trading;