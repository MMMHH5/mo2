import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCourseProfit, calculateInstructorEntitlement } from '../src/finance/accounting.math';

describe('finance accounting calculations', () => {
    test('calculates instructor entitlement from net collected revenue', () => {
        assert.equal(calculateInstructorEntitlement(1_000, 25), 250);
        assert.equal(calculateInstructorEntitlement(1_000, 0), 0);
        assert.equal(calculateInstructorEntitlement(1_000, null), 0);
    });

    test('rounds instructor entitlement to the currency precision', () => {
        assert.equal(calculateInstructorEntitlement(99.99, 33.33), 33.33);
    });

    test('subtracts entitlement and only paid operating costs from course profit', () => {
        assert.equal(calculateCourseProfit(1_000, 250, 100), 650);
        assert.equal(calculateCourseProfit(250, 62.5, 200), -12.5);
    });
});
