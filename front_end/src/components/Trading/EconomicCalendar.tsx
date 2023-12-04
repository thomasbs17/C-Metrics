import React from 'react'

function EconomicCalendar() {
  return (
    <div style={{ textAlign: 'center', overflowY: 'auto' }}>
      <iframe
        title="economic-calendar"
        src="https://sslecal2.investing.com?ecoDayBackground=%23000000&defaultFont=%23ffffff&columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&importance=3&features=datepicker,timeselector,filters&countries=25,32,6,37,72,22,17,39,14,10,35,43,56,36,110,11,26,12,4,5&calType=day&timeZone=15&lang=1"
        width="100%"
        height="450"
        allowTransparency={true}
        style={{
          margin: '0 auto',
          display: 'block',
        }}
      >
        dfdf
      </iframe>
    </div>
  )
}

export default EconomicCalendar
