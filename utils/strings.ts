/**
 * Converts any string into camel case format.
 */
export const toCamelCase = (str: string): string => {
    return str
        .toLowerCase()
        .replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => (index === 0 ? match.toLowerCase() : match.toUpperCase()))
        .replace(/\s+/g, '');
};

/**
 * Converts any string into pascal case format.
 */
export const toPascalCase = (str: string): string => {
    return str.replace(/\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
};
