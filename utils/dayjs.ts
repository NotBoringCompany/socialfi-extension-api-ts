import Dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

Dayjs.extend(relativeTime);
Dayjs.extend(isSameOrAfter);
Dayjs.extend(isSameOrBefore);
Dayjs.extend(customParseFormat);
Dayjs.extend(duration);
Dayjs.extend(utc);
Dayjs.extend(timezone);
Dayjs.extend(localizedFormat);

export const dayjs = Dayjs;