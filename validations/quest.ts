import { z } from 'zod';
import { POIName } from '../models/poi';

export const questDailyQuery = z.object({
    poi: z.nativeEnum(POIName, { message: 'POI not valid' }),
});

export type QuestDailyQuery = z.infer<typeof questDailyQuery>;