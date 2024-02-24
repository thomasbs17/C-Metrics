import { CircularProgress } from '@mui/material'
import { CellMouseOverEvent, ColDef } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { type NewsArticle, type tradingDataDef } from '../DataManagement'
import { filterSlice } from '../StateManagement'

function News(data: { tradingData: tradingDataDef }) {
  const news = data.tradingData.news.sort(
    (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
  )
  const dispatch = useDispatch()
  const [colDefs, setColDefs] = useState<ColDef<NewsArticle>[]>([])

  useEffect(() => {
    setColDefs([
      { field: 'date' },
      { field: 'media' },
      {
        field: 'title',
        flex: 1,
        cellRenderer: function (article: CellMouseOverEvent<NewsArticle, any>) {
          if (article.rowIndex || article.rowIndex === 0) {
            const hoveredArticle = news[article.rowIndex]
            if (hoveredArticle !== undefined) {
              return (
                <a href={'https://' + hoveredArticle.link} target="_blank">
                  {hoveredArticle.title}
                </a>
              )
            }
          }
        },
      },
    ])
  }, [data.tradingData.news])

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
        rowData={news}
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
