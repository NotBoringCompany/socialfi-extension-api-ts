import { z, ZodSchema } from 'zod';
import { ReturnValue, Status } from './retVal';

declare module 'zod' {
    interface ZodSchema<Output = any, Def extends z.ZodTypeDef = z.ZodTypeDef, Input = Output> {
        validate: (data: unknown) => ReturnValue<Output>;
    }
}

ZodSchema.prototype.validate = function <Output>(this: ZodSchema<Output>, data: unknown): ReturnValue {
    const validationResult = this.safeParse(data);

    if (validationResult.success) {
        return {
            status: Status.SUCCESS,
            message: 'Validation successful',
            data: validationResult.data,
        };
    } else {
        // Map errors to an object with field names as keys and their messages as values
        const errors = validationResult.error.errors.reduce((acc, error) => {
            acc[error.path.join('.')] = error.message;
            return acc;
        }, {} as Record<string, string>);

        return {
            status: Status.INVALID_PAYLOAD,
            message: 'Validation failed',
            data: { errors },
        };
    }
};
