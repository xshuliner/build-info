export function formatLocalMinute(isoTime: string): string {
  if (!isoTime) {
    return ''
  }

  const date = new Date(isoTime)
  if (Number.isNaN(date.getTime())) {
    return isoTime
  }

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
