export const parseTimeToMinutes = (time: string | null | undefined) => {
  if (!time) return null;
  const normalizedTime = time.trim().toUpperCase();
  const hasAmPm = /AM|PM/i.test(normalizedTime);
  
  // Extract numbers
  const timeParts = normalizedTime.replace(/AM|PM/gi, '').trim().split(':');
  let hours = parseInt(timeParts[0], 10);
  let minutes = timeParts.length > 1 ? parseInt(timeParts[1], 10) : 0;
  
  if (Number.isNaN(hours)) return null;
  if (Number.isNaN(minutes)) minutes = 0;

  if (hasAmPm) {
    const ampm = normalizedTime.match(/AM|PM/i)?.[0];
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  }

  return hours * 60 + minutes;
};

export const formatTimeDisplay = (date: Date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strMinutes = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${strMinutes} ${ampm}`;
};
