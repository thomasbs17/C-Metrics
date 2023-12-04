import React from 'react'
import {
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { type FilterState, filterSlice } from '../StateManagement'

function displayAsPercent(raw_number: number) {
  return (raw_number * 100).toFixed(2) + '%'
}

function Screening(data: any) {
  const dispatch = useDispatch()
  const screeningData = data.screeningData
  const selectedPair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )

  const handleClick = (pairDetails: any) => {
    dispatch(filterSlice.actions.setPair(pairDetails.pair))
    dispatch(filterSlice.actions.setPairScoreDetails(pairDetails))
    dispatch(filterSlice.actions.setSelectedOrder(['', '', '']))
  }

  return screeningData.length === 0 ? (
    <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
  ) : (
    <TableContainer sx={{ maxHeight: 210 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell align="left" sx={{ fontSize: 9 }}>
              <u>Pair</u>
            </TableCell>
            <TableCell align="left" sx={{ fontSize: 9 }}>
              <u>Support</u>
            </TableCell>
            <TableCell align="left" sx={{ fontSize: 9 }}>
              <u>Resistance</u>
            </TableCell>
            <TableCell align="left" sx={{ fontSize: 9 }}>
              <u>% to Support</u>
            </TableCell>
            <TableCell align="left" sx={{ fontSize: 9 }}>
              <u>% to RSI</u>
            </TableCell>
            <TableCell align="left" sx={{ fontSize: 9 }}>
              <u>% to Bollinger</u>
            </TableCell>
            <TableCell align="left" sx={{ fontSize: 9 }}>
              <u>Book Score</u>
            </TableCell>
            <TableCell align="left" sx={{ fontSize: 9 }}>
              <u>Technicals Score</u>
            </TableCell>
            <TableCell align="left" sx={{ fontSize: 9 }}>
              <u>Total Score</u>
            </TableCell>
            <TableCell align="left" sx={{ fontSize: 9 }}>
              <u>Potential Gain</u>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {screeningData.map((pairDetails: any, index: number) => (
            <TableRow
              key={index}
              sx={{
                '&:last-child td, &:last-child th': { border: 0 },
                cursor: 'pointer',
                backgroundColor:
                  pairDetails.pair === selectedPair ? 'green' : 'transparent',
              }}
              hover
              onClick={() => {
                handleClick(pairDetails)
              }}
            >
              <TableCell align="left" sx={{ fontSize: 11 }}>
                {pairDetails.pair}
              </TableCell>
              <TableCell align="left" sx={{ fontSize: 11 }}>
                {pairDetails.next_support}
              </TableCell>
              <TableCell align="left" sx={{ fontSize: 11 }}>
                {pairDetails.next_resistance}
              </TableCell>
              <TableCell align="left" sx={{ fontSize: 11 }}>
                {displayAsPercent(pairDetails.distance_to_next_support - 1)}
              </TableCell>
              <TableCell align="left" sx={{ fontSize: 11 }}>
                {displayAsPercent(pairDetails.distance_to_rsi - 1)}
              </TableCell>
              <TableCell align="left" sx={{ fontSize: 11 }}>
                {displayAsPercent(pairDetails.distance_to_lower_bollinger - 1)}
              </TableCell>
              <TableCell align="left" sx={{ fontSize: 11 }}>
                {pairDetails.book_score.toFixed(2)}
              </TableCell>
              <TableCell align="left" sx={{ fontSize: 11 }}>
                {pairDetails.technicals_score.toFixed(2)}
              </TableCell>
              <TableCell align="left" sx={{ fontSize: 11 }}>
                {pairDetails.score.toFixed(2)}
              </TableCell>
              <TableCell align="left" sx={{ fontSize: 11 }}>
                {displayAsPercent(pairDetails.potential_gain)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default Screening
