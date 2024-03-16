import React, { useEffect } from 'react'

function EconomicCalendar() {
  useEffect(() => {
    const updateIframeContent = () => {
      const iframe = document.querySelector<HTMLIFrameElement>(
        'iframe[name="economic-calendar"]',
      )
      if (iframe) {
        const iframeDocument =
          iframe.contentDocument || iframe.contentWindow?.document
        const tableElement =
          iframeDocument?.querySelector<HTMLTableElement>('inlineblock')
        if (tableElement) {
          tableElement.style.maxWidth = '100%'
        }
      }
    }

    updateIframeContent()
  }, [])

  return (
    <div style={{ maxHeight: '300px' }}>
      <iframe
        title="economic-calendar"
        src="https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&category=_employment,_economicActivity,_inflation,_credit,_centralBanks,_confidenceIndex,_balance,_Bonds&importance=3&features=datepicker,timezone,filters&countries=72,4,5&calType=week&timeZone=15&lang=51"
        width="100%"
        height="210px"
        style={{
          margin: '0 auto',
          display: 'block',
        }}
      ></iframe>
    </div>
  )
}

export default EconomicCalendar
