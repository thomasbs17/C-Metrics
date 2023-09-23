import React, { useEffect, useRef, useState } from 'react';
import { Accordion, Button, ButtonGroup, Col, Container, Form, Row, Stack, Tab, Tabs, ToggleButton } from 'react-bootstrap';

type OrderTypeSideProps = {
    selectedOrderSide: string;
    handleOrderSideChange: (radio: string) => void;
};

type OrderTypeFilterProps = {
    orderTypes: Array<string>;
    selectedOrderType: string;
    handleOrderTypeChange: (radio: string) => void;
};


function OrderSideFilter({ selectedOrderSide, handleOrderSideChange }: OrderTypeSideProps) {
    return (
        <div>
            {['Buy', 'Sell'].map((orderSide) => (
                <div key={orderSide} className="mb-3" style={{ display: 'inline-block' }} id={`${orderSide}_filter`}>
                    <Form.Check
                        inline
                        type={'radio'}
                        id={orderSide}
                        label={orderSide}
                        checked={selectedOrderSide === orderSide}
                        onChange={() => handleOrderSideChange(orderSide)}
                    />
                </div>
            ))}
        </div>
    );
}

function OrderTypeFilter({ orderTypes, selectedOrderType, handleOrderTypeChange }: OrderTypeFilterProps) {
    return (
        <div>
            {orderTypes.map((orderType) => (
                <div key={orderType} className="mb-3" style={{ display: 'inline-block' }} id={`${orderType}_filter`}>
                    <Form.Check
                        inline
                        type={'radio'}
                        id={orderType}
                        label={orderType}
                        checked={selectedOrderType === orderType}
                        onChange={() => handleOrderTypeChange(orderType)}
                    />
                </div>
            ))}
        </div>
    );
}


function OrderDetails() {
    const orderTypes = ['Limit', 'Market'];
    const [selectedOrderSide, setSelectedOrderSide] = useState<string>('Buy');
    const [selectedOrderType, setSelectedOrderType] = useState<string>(orderTypes[0]);

    const handleOrderSideChange = (radio: string) => {
        setSelectedOrderSide(radio);
    };

    const handleOrderTypeChange = (radio: string) => {
        setSelectedOrderType(radio);
    };

    return (
        <Container>
            <Form style={{ height: '200px' }}>
                <Row>
                    <Col>
                        <OrderSideFilter selectedOrderSide={selectedOrderSide} handleOrderSideChange={handleOrderSideChange} />
                    </Col>
                    <Col xs={9}>
                        <OrderTypeFilter orderTypes={orderTypes} selectedOrderType={selectedOrderType} handleOrderTypeChange={handleOrderTypeChange} />
                    </Col>
                </Row>
                <Row>
                    {selectedOrderType === 'Limit' &&
                        <Col>
                            <Form.Group controlId="limitPrice">
                                <Form.Label>Limit Price:</Form.Label>
                                <Form.Control
                                    type="number"
                                    min={0}
                                />
                            </Form.Group>
                        </Col>
                    }
                    <Col>
                        <Form.Group controlId="amount">
                            <Form.Label>Order Amount:</Form.Label>
                            <Form.Control
                                type="number"
                                min={0}
                            />
                        </Form.Group>
                    </Col>
                </Row>

                <Form.Group controlId="amount" style={{ padding: '10px' }} >
                    <Button variant={selectedOrderSide === 'Buy' ? 'success' : 'danger'} style={{ width: '100%' }}>{selectedOrderSide}</Button>
                </Form.Group>
            </Form>
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
