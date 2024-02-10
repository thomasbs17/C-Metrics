import React, { useState } from 'react'
import {
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { useDispatch } from 'react-redux'
import { type NewsArticle, type tradingDataDef } from '../DataManagement'
import { filterSlice } from '../StateManagement'
import { CellMouseOverEvent, ColDef } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'

function News(data: { tradingData: tradingDataDef }) {
  const news = data.tradingData.news.sort(
    (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
  )
  const dispatch = useDispatch()

  const [rowData, setRowData] = useState<NewsArticle[]>(news)

  const [colDefs, setColDefs] = useState<ColDef<NewsArticle>[]>([
    { field: 'date' },
    { field: 'media' },
    { field: 'title', flex: 1 },
  ])

  function handleHover(article: CellMouseOverEvent<NewsArticle, any>) {
    if (article.rowIndex) {
      const hoveredArticle = news[article.rowIndex]
      dispatch(
        filterSlice.actions.setSelectedArticle([
          hoveredArticle.datetime,
          hoveredArticle.title,
        ]),
      )
    }
  }

  return news.length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <div
      className={'ag-theme-quartz-dark'}
      style={{ width: '100%', height: '180px' }}
    >
      <AgGridReact
        rowData={rowData}
        columnDefs={colDefs}
        onCellMouseOver={(t) => handleHover(t)}
        onCellMouseOut={() =>
          dispatch(filterSlice.actions.setSelectedArticle(['', '']))
        }
      />
    </div>
  )
}

export default News
