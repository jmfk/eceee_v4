import { afterEach, describe, expect, it } from 'vitest';
import { contentHostname } from '../src/hostname';

describe('publisher test hostname mapping', () => {
  afterEach(() => {
    delete process.env.PUBLISHER_TEST_HOST_MAPPINGS;
  });

  it('maps each configured test hostname to its published source host', () => {
    process.env.PUBLISHER_TEST_HOST_MAPPINGS = [
      'Eceee-Test.Colliberty.com=eceee.org',
      'summerstudy-test.colliberty.com=summerstudy.eceee.org',
      'industry-test.colliberty.com=industry.eceee.org',
    ].join(',');

    expect(contentHostname('eceee-test.colliberty.com:443')).toBe('eceee.org');
    expect(contentHostname('summerstudy-test.colliberty.com')).toBe('summerstudy.eceee.org');
    expect(contentHostname('industry-test.colliberty.com')).toBe('industry.eceee.org');
    expect(contentHostname('industry.eceee.org')).toBe('industry.eceee.org');
  });

  it('ignores malformed mappings and fails closed for unconfigured hosts', () => {
    process.env.PUBLISHER_TEST_HOST_MAPPINGS = [
      'eceee-test.colliberty.com=https://eceee.org',
      'missing-source.colliberty.com=',
      'too=many=parts',
    ].join(',');

    expect(contentHostname('eceee-test.colliberty.com')).toBe('eceee-test.colliberty.com');
    expect(contentHostname('missing-source.colliberty.com')).toBe('missing-source.colliberty.com');
  });
});
