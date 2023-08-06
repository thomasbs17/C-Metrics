import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FilterState } from '../StateManagement';


function GetData() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    fetch('https://jsonplaceholder.typicode.com/posts?_limit=10')
      .then((response) => response.json())
      .then((data) => {
        setPosts(data);
      })
      .catch((err) => {
        console.log(err.message);
      });
  }, []);
  return posts
}

function LineChart() {
  const { tradingType, exchange, currency, asset } = useSelector((state: FilterState) => state);
  const options = {
    title: {
      text: `${exchange}: ${asset}-${currency}`
    },
    series: [{
      data: [1, 2, 3],
    }],
    chart: { backgroundColor: 'transparent', height: 600 },
    credits: { enabled: false }
  };

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
    />
  );
};

export default LineChart;