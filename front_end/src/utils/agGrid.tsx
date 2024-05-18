import { Avatar } from '@mui/material'

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
