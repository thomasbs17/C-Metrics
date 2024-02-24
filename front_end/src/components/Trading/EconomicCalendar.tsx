import React from 'react'

function EconomicCalendar() {
  return (
    <div style={{ textAlign: 'center', overflowY: 'auto' }}>
      <iframe
        title="economic-calendar"
        src="https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&category=_employment,_economicActivity,_inflation,_credit,_centralBanks,_confidenceIndex,_balance,_Bonds&importance=3&features=datepicker,timezone,filters&countries=72,4,5&calType=day&timeZone=15&lang=51"
        width="100%"
        height="450"
        allowTransparency={true}
        style={{
          margin: '0 auto',
          display: 'block',
        }}
      ></iframe>
    </div>
  )
}

export default EconomicCalendar
