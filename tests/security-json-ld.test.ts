import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeJsonLd } from '../frontend/src/lib/json-ld';

describe('SECURITY: JSON-LD script serialization', () => {
    test('escapes script-closing characters while preserving JSON data', () => {
        const payload = { name: '</script><script>alert(1)</script>' };

        const serialized = serializeJsonLd(payload);

        assert.equal(serialized.includes('</script>'), false);
        assert.deepEqual(JSON.parse(serialized), payload);
    });
});
