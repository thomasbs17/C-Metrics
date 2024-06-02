import { Avatar } from '@mui/material'
import { ValueFormatterParams } from 'ag-grid-community'

export function defaultValueFormat(params: ValueFormatterParams) {
  return params.value ? `${Number(params.value * 100).toFixed(2)}%` : ''
}

export function renderCellWithImage(text: string, imageSrc: string) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'flex-start',
        alignItems: 'baseline',
      }}
    >
      <Avatar src={imageSrc} sx={{ width: 15, height: 15 }} />
      {text}
    </div>
  )
}
