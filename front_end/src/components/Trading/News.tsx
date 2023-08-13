import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FilterState } from '../StateManagement';
import { Table, Image, Spinner } from 'react-bootstrap';

type NewsArticle = {
    date: string,
    title: string,
    media: string,
    img: string,
    link: string,
    datetime: string
}



function LoadNews() {
    const { tradingType, exchange, currency, asset } = useSelector((state: FilterState) => state);
    const pair = `${asset}/${currency}`
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
    return (
        news.length === 0 ?
            <Spinner style={{ marginLeft: '50%', marginTop: '10%' }}></Spinner>
            :
            <Table striped bordered hover size="sm" responsive >
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Title</th>
                        <th>Media</th>
                        <th>Image</th>
                    </tr>
                </thead>
                <tbody >
                    {news.map(article =>
                        <tr>
                            <td>{article.date}</td>
                            <td><a href={`https:/${article.link}`} target="_blank">{article.title}</a></td>
                            <td>{article.media}</td>
                            <td><Image src={article.img} thumbnail /></td>
                        </tr>
                    )}
                </tbody>
            </Table>

    );
}

export default News;