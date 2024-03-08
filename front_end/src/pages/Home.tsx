import React, { useState } from 'react'
import { Layout, Responsive, WidthProvider } from 'react-grid-layout'
import NavBar from '../components/Navbar'

const ResponsiveReactGridLayout = WidthProvider(Responsive)

interface Item {
  i: string
  x: number
  y: number
  w: number
  h: number
  add?: boolean
}

interface AddRemoveLayoutProps {
  className?: string
  cols?: { lg: number; md: number; sm: number; xs: number; xxs: number }
  rowHeight?: number
  onLayoutChange?: (layout: Layout[]) => void
}

interface AddRemoveLayoutState {
  items: Item[]
  newCounter: number
  breakpoint?: string
  layout?: Layout[]
}

const FullScreenDiv: React.FC = () => {
  const [isFullScreen, setIsFullScreen] = useState(false)

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen)
  }

  const fullScreenDivStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
    background: 'black',
  }

  return (
    <div style={isFullScreen ? fullScreenDivStyle : undefined}>
      <button onClick={toggleFullScreen}>
        {isFullScreen ? 'Exit' : 'Go'} Full Screen
      </button>
    </div>
  )
}

export default class AddRemoveLayout extends React.PureComponent<
  AddRemoveLayoutProps,
  AddRemoveLayoutState
> {
  static defaultProps: AddRemoveLayoutProps = {
    className: 'layout',
    cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
    rowHeight: 100,
  }

  constructor(props: AddRemoveLayoutProps) {
    super(props)

    this.state = {
      items: [0, 1, 2, 3, 4].map((i) => ({
        i: i.toString(),
        x: i * 2,
        y: 0,
        w: 2,
        h: 2,
        add: i === 4,
      })),
      newCounter: 0,
    }

    this.onAddItem = this.onAddItem.bind(this)
    this.onBreakpointChange = this.onBreakpointChange.bind(this)
    this.onLayoutChange = this.onLayoutChange.bind(this)
  }

  createElement(el: Item) {
    const removeStyle: React.CSSProperties = {
      position: 'absolute',
      right: '2px',
      top: 0,
      cursor: 'pointer',
    }
    const i = el.add ? '+' : el.i

    return (
      <div key={i} data-grid={el} style={{ border: 'solid 1px white' }}>
        {el.add ? (
          <span
            className="cancelDrag"
            onClick={this.onAddItem}
            title="You can add an item by clicking here, too."
          >
            Add +
          </span>
        ) : (
          <button className="cancelDrag">Go full screen on {i}</button>
        )}
        <span
          className="cancelDrag"
          style={removeStyle}
          onClick={() => this.onRemoveItem(i)}
        >
          x
        </span>
      </div>
    )
  }

  onAddItem() {
    console.log('adding', 'n' + this.state.newCounter)
    this.setState((prevState) => ({
      items: prevState.items.concat({
        i: 'n' + prevState.newCounter,
        x: (prevState.items.length * 2) % (this.props.cols?.lg ?? 12),
        y: Infinity,
        w: 2,
        h: 2,
      }),
      newCounter: prevState.newCounter + 1,
    }))
  }

  onBreakpointChange(newBreakpoint: string, newCols: number) {
    this.setState((prevState) => ({
      ...prevState,
      breakpoint: newBreakpoint,
      cols: newCols,
    }))
  }

  onLayoutChange(layout: Layout[]) {
    if (this.props.onLayoutChange) {
      this.props.onLayoutChange(layout)
    }
    this.setState({ layout: layout })
  }

  onRemoveItem(i: string) {
    console.log('removing', i)
    this.setState((prevState) => ({
      items: prevState.items.filter((item) => item.i !== i),
    }))
  }

  render() {
    return (
      <div>
        <NavBar />
        <button onClick={this.onAddItem}>Add Item</button>
        <ResponsiveReactGridLayout
          onLayoutChange={this.onLayoutChange}
          onBreakpointChange={this.onBreakpointChange}
          draggableCancel=".cancelDrag"
          {...this.props}
        >
          {this.state.items.map((el) => this.createElement(el))}
        </ResponsiveReactGridLayout>
        <FullScreenDiv />
      </div>
    )
  }
}
