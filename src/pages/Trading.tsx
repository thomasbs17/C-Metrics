import { Col, Container, Dropdown, Placeholder, Row, Stack } from 'react-bootstrap';
import TradeHistory from '../components/Trading/TradeHistory'
import LineChart from '../components/Trading/Chart';
import Screening from '../components/Trading/Screening';
import CreateOrderWidget from '../components/Trading/CreateOrder';
import News from '../components/Trading/News';
import { Filters } from '../components/Trading/Filters';
import { Provider } from 'react-redux';
import { filtersStore } from '../components/StateManagement';





function Trading() {
    return (
        <div>
            <Provider store={filtersStore}>
                <Filters />
                <Container fluid>
                    <Row>
                        <Col sm={10}>
                            <Stack gap={2}>
                                <LineChart />
                                <TradeHistory />
                            </Stack>
                        </Col>
                        <Col>
                            <Stack gap={2}>
                                <CreateOrderWidget />
                                <Screening />
                                <News />
                            </Stack>
                        </Col>
                    </Row>
                </Container>
            </Provider>
        </div>
    );
}

export default Trading;