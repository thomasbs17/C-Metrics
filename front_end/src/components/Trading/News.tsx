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
import { NewsArticle, tradingDataDef } from '../DataManagement'
import { filterSlice } from '../StateManagement'




function News(data: { tradingData: tradingDataDef }) {
  const news = data.tradingData.news.sort(
    (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
  )
  const dispatch = useDispatch()

  return news.length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <TableContainer sx={{ maxHeight: 210 }}>
      <Table stickyHeader aria-label="sticky table" size="small">
        <TableHead>
          <TableRow>
            <TableCell align="left">
              <u>Date</u>
            </TableCell>
            <TableCell align="left">
              <u>Media</u>
            </TableCell>
            <TableCell align="left">
              <u>Title</u>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {news.map((article: NewsArticle, index: number) => (
            <TableRow
              key={index}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              hover
              onMouseEnter={() =>
                dispatch(
                  filterSlice.actions.setSelectedArticle([
                    article.datetime,
                    article.title,
                  ]),
                )
              }
              onMouseLeave={() =>
                dispatch(filterSlice.actions.setSelectedArticle(['', '']))
              }
            >
              <TableCell align="left" width={120}>
                {article.date}
              </TableCell>
              <TableCell align="left" width={150}>
                {article.media}
              </TableCell>
              <TableCell align="left">
                <a
                  href={`https://${article.link}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {article.title}
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default News
