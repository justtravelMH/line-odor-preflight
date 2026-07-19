import type {TimeBucket} from './types';

export function localRecordTime(at: Date, timezone = 'Asia/Taipei') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(value('hour'));
  const timeBucket: TimeBucket =
    hour >= 5 && hour < 12
      ? 'MORNING'
      : hour >= 12 && hour < 17
        ? 'AFTERNOON'
        : hour >= 17 && hour < 22
          ? 'EVENING'
          : 'NIGHT';
  return {
    localDate: `${value('year')}-${value('month')}-${value('day')}`,
    timeBucket,
  };
}
