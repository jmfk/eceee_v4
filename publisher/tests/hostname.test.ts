import { describe, expect, it } from 'vitest';
import { contentHostname } from '../src/hostname';

describe('publisher content hostname', () => {
  it('resolves each test hostname directly against its root-page aliases', () => {
    expect(contentHostname('Eceee-Test.Colliberty.com:443')).toBe('eceee-test.colliberty.com');
    expect(contentHostname('summerstudy-test.colliberty.com')).toBe('summerstudy-test.colliberty.com');
    expect(contentHostname('industry-test.colliberty.com')).toBe('industry-test.colliberty.com');
  });

  it('does not translate a test hostname to another domain', () => {
    expect(contentHostname('eceee-test.colliberty.com')).not.toBe('eceee.org');
    expect(contentHostname('industry.eceee.org')).toBe('industry.eceee.org');
  });
});
