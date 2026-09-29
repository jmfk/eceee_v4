import { afterEach, describe, expect, it } from 'vitest';
import { contentHostname } from '../src/hostname';

describe('publisher test hostname mapping', () => {
  afterEach(() => {
    delete process.env.PUBLISHER_TEST_DOMAIN;
    delete process.env.PUBLISHER_TEST_SOURCE_HOST;
  });

  it('maps only the configured test hostname to the published source host', () => {
    process.env.PUBLISHER_TEST_DOMAIN = 'Publisher-Test-Eceee.Colliberty.com';
    process.env.PUBLISHER_TEST_SOURCE_HOST = 'summerstudy.eceee.org';

    expect(contentHostname('publisher-test-eceee.colliberty.com:443')).toBe('summerstudy.eceee.org');
    expect(contentHostname('industry.eceee.org')).toBe('industry.eceee.org');
  });

  it('fails closed when either side of the mapping is invalid or missing', () => {
    process.env.PUBLISHER_TEST_DOMAIN = 'publisher-test-eceee.colliberty.com';
    process.env.PUBLISHER_TEST_SOURCE_HOST = 'https://summerstudy.eceee.org';

    expect(contentHostname('publisher-test-eceee.colliberty.com')).toBe('publisher-test-eceee.colliberty.com');
  });
});

