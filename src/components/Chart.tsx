import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useEffect, useState } from 'react';


function GetData() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    fetch('https://jsonplaceholder.typicode.com/posts?_limit=10')
      .then((response) => response.json())
      .then((data) => {
        console.log(data);
        setPosts(data);
      })
      .catch((err) => {
        console.log(err.message);
      });
  }, []);
  return posts
}

function LineChart() {
  const selectedExchange = (document.getElementById('exchange-dropdown') as HTMLInputElement).value
  const selectedCurrency = (document.getElementById('exchange-dropdown') as HTMLInputElement).value
  const selectedAsset = (document.getElementById('exchange-dropdown') as HTMLInputElement).value
  const options = {
    title: {
      
      text: `${selectedExchange}: ${selectedCurrency}-${selectedAsset}`
    },
    series: [{
      data: [1, 2, 3],
    }],
    chart: { backgroundColor: 'transparent' , height: 650}
  };
  console.log(GetData())

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={options}
    />
  );
};

export default LineChart;