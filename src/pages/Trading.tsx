import { Col, Container, Dropdown, Placeholder, Row, Stack } from 'react-bootstrap';
import TradeHistory from '../components/TradeHistory'
import LineChart from '../components/Chart';
import Screening from '../components/Screening';
import CreateOrderWidget from '../components/CreateOrder';
import News from '../components/News';


function Filters() {
    return (
        <Container fluid style={{display:'flex', justifyContent:'left'}}>
            <Row>
                <Col>
                    <Dropdown>
                        <Dropdown.Toggle variant="success" id="exchange-dropdown">
                            Exchange
                        </Dropdown.Toggle>

                        <Dropdown.Menu>
                            <Dropdown.Item href="#/action-1">Coinbase</Dropdown.Item>
                            <Dropdown.Item disabled href="#/action-2">Kraken</Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </Col>
                <Col>
                    <Dropdown>
                        <Dropdown.Toggle variant="success" id="currency-dropdown">
                            Currency
                        </Dropdown.Toggle>

                        <Dropdown.Menu>
                            <Dropdown.Item href="#/action-1">GBP</Dropdown.Item>
                            <Dropdown.Item href="#/action-2">USD</Dropdown.Item>
                            <Dropdown.Item href="#/action-3">EUR</Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </Col>
                <Col>
                    <Dropdown>
                        <Dropdown.Toggle variant="success" id="asset-dropdown">
                            Assets
                        </Dropdown.Toggle>

                        <Dropdown.Menu>
                            <Dropdown.Item href="#/action-1">Action</Dropdown.Item>
                            <Dropdown.Item href="#/action-2">Another action</Dropdown.Item>
                            <Dropdown.Item href="#/action-3">Something else</Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </Col>
            </Row>
        </Container>
    )
}

function Trading() {
    return (
        <div>
            <Filters />
            <Container fluid>
                <Row>
                    <Col sm={9}>
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
        </div>
    );
}

export default Trading;