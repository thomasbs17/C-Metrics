import { CircularProgress } from '@mui/material'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { TwitterTimelineEmbed } from 'react-twitter-embed'
import { tradingDataDef } from './DataManagement'
import { FilterState } from './StateManagement'

function TwitterFeed(data: { tradingData: tradingDataDef }) {
  const pair = useSelector(
    (state: { filters: FilterState }) => state.filters.pair,
  )

  const [twitterName, setTwitterName] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (Object.keys(data.tradingData.cryptoMetaData).includes('data')) {
      const metaData = data.tradingData.cryptoMetaData['data']
      const pairId = Object.keys(metaData)[0]
      const twitterProfile = metaData[pairId].twitter_username
      setTwitterName(twitterProfile ? twitterProfile : metaData[pairId].name)
    }
  }, [pair, JSON.stringify(data.tradingData.cryptoMetaData)])

  return (
    <div style={{ height: '210px' }}>
      {twitterName ? (
        <TwitterTimelineEmbed
          sourceType="profile"
          screenName={twitterName}
          options={{ height: '210px' }}
          borderColor="#fff"
          placeholder={
            <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
          }
          theme={'dark'}
        />
      ) : (
        <CircularProgress style={{ marginLeft: '50%', marginTop: '10%' }} />
      )}
    </div>
  )
}

export default TwitterFeed
