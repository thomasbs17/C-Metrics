import React, { useEffect, useRef, useState } from 'react';
import { Accordion, Button, ButtonGroup, Form, Stack, Tab, Tabs, ToggleButton } from 'react-bootstrap';

type OrderTypeFilterProps = {
    orderTypes: Array<string>;
    selectedOrderType: string;
    handleOrderTypeChange: (radio: string) => void;
};

type OrderDetailsProps = {
    orderDirection: string;
};



function OrderTypeFilter({ orderTypes, selectedOrderType, handleOrderTypeChange }: OrderTypeFilterProps) {
    return (
        <div>
            {/* Use a div with inline display for horizontal layout */}
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


function OrderDetails({ orderDirection }: OrderDetailsProps) {
    const orderTypes = ['Limit', 'Market'];
    const [selectedOrderType, setSelectedOrderType] = useState<string>(orderTypes[0]);

    const handleOrderTypeChange = (radio: string) => {
        setSelectedOrderType(radio);
    };

    return (
        <Form>
            <OrderTypeFilter orderTypes={orderTypes} selectedOrderType={selectedOrderType} handleOrderTypeChange={handleOrderTypeChange} />
            {selectedOrderType === 'Limit' ?
                <Form.Group controlId="limitPrice">
                    <Form.Label>Limit Price:</Form.Label>
                    <Form.Control
                        type="number"
                    />
                </Form.Group>
                :
                null}
            <Form.Group controlId="amount">
                <Form.Label>Order Amount:</Form.Label>
                <Form.Control
                    type="number"
                />
            </Form.Group>
            <Form.Group controlId="amount" style={{ padding: '10px' }} >
                <Button variant={orderDirection === 'Buy' ? 'success' : 'danger'} style={{ width: '100%' }}>{orderDirection}</Button>
            </Form.Group>
        </Form>
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
        height: '400px'
    };

    return (
        <Stack className="border border-primary rounded-3 p-3" style={containerStyle} ref={containerRef}>
            <Tabs
                defaultActiveKey="buy"
                className="mb-3"
                fill
            >
                <Tab eventKey="buy" title="Buy">
                    <OrderDetails orderDirection='Buy' />
                </Tab>
                <Tab eventKey="sell" title="Sell">
                    <OrderDetails orderDirection='Sell' />
                </Tab>
            </Tabs>
        </Stack>
    );

}

export default CreateOrderWidget;
