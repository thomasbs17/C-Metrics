import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FilterState, filterSlice } from '../StateManagement';
import { Image, Spinner } from 'react-bootstrap';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { Button, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { TouchRippleActions } from '@mui/material/ButtonBase/TouchRipple';

type NewsArticle = {
    date: string,
    title: string,
    media: string,
    img: string,
    link: string,
    datetime: string
}



function LoadNews() {
    const pair = useSelector((state: { filters: FilterState }) => state.filters.pair);
    const [news, setNewsData] = useState<Array<NewsArticle>>([]);
    useEffect(() => {
        async function getNewsData() {
            setNewsData([]);
            try {
                const response = await fetch(`http://127.0.0.1:8000/news/?pair=${pair}`);
                const data = await response.json();
                setNewsData(data);
            } catch (error) {
                setNewsData([]);
                console.error('Error fetching news:', error);
            }
        }
        getNewsData();
    }, [pair]);
    return news;
}

function News() {
    let news = LoadNews();
    news = news.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
    const dispatch = useDispatch();

    return (
        news.length === 0 ?
            <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
            :
            <TableContainer sx={{ maxHeight: 230 }}>
                <Table stickyHeader aria-label="sticky table">
                    <TableHead>
                        <TableRow>
                            <TableCell align="center"><u>Date</u></TableCell>
                            <TableCell align="center"><u>Media</u></TableCell>
                            <TableCell align="center"><u>Title</u></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {news.map((article: NewsArticle, index: number) => (
                            <TableRow
                                key={index}
                                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                hover
                                onMouseEnter={() => dispatch(filterSlice.actions.setSelectedArticle([article.datetime, article.title]))}
                                onMouseLeave={() => dispatch(filterSlice.actions.setSelectedArticle(['', '']))}
                            >
                                <TableCell align="center">{article.date}</TableCell>
                                <TableCell align="center">{article.media}</TableCell>
                                <TableCell align="center"><a href={`https://${article.link}`} target='_blank' rel="noreferrer">{article.title}</a></TableCell>
                            </TableRow>
                        ))
                        }
                    </TableBody>
                </Table>
            </TableContainer>
    );
}

export default News;