export function serializeJsonLd(data: unknown): string {
    const serialized = JSON.stringify(data);
    if (serialized === undefined) {
        throw new TypeError('JSON-LD data must be serializable');
    }
    return serialized.replace(/</g, '\\u003c');
}
