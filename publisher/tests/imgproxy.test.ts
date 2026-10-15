import { afterEach, describe, expect, it } from 'vitest';
import { internalImageSourceUrl, responsiveImageSources } from '../src/imgproxy';

const originalEnvironment = {
  publicEndpoint: process.env.AWS_S3_ENDPOINT_URL,
  internalEndpoint: process.env.AWS_S3_INTERNAL_ENDPOINT_URL,
  key: process.env.PUBLISHER_IMGPROXY_KEY,
  salt: process.env.PUBLISHER_IMGPROXY_SALT,
};

afterEach(() => {
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore('AWS_S3_ENDPOINT_URL', originalEnvironment.publicEndpoint);
  restore('AWS_S3_INTERNAL_ENDPOINT_URL', originalEnvironment.internalEndpoint);
  restore('PUBLISHER_IMGPROXY_KEY', originalEnvironment.key);
  restore('PUBLISHER_IMGPROXY_SALT', originalEnvironment.salt);
});

describe('publisher imgproxy source URLs', () => {
  it('maps the browser-facing local MinIO endpoint to the container-facing endpoint', () => {
    process.env.AWS_S3_ENDPOINT_URL = 'http://localhost:10302';
    process.env.AWS_S3_INTERNAL_ENDPOINT_URL = 'http://host.docker.internal:10302';

    expect(internalImageSourceUrl('http://localhost:10302/eceee-media/image.png'))
      .toBe('http://host.docker.internal:10302/eceee-media/image.png');
    expect(internalImageSourceUrl('https://media.example/image.png'))
      .toBe('https://media.example/image.png');
  });

  it('signs the normalized source without exposing the internal endpoint to the browser', () => {
    process.env.AWS_S3_ENDPOINT_URL = 'http://localhost:10302';
    process.env.AWS_S3_INTERNAL_ENDPOINT_URL = 'http://host.docker.internal:10302';
    process.env.PUBLISHER_IMGPROXY_KEY = '00'.repeat(32);
    process.env.PUBLISHER_IMGPROXY_SALT = '11'.repeat(32);

    const result = responsiveImageSources(
      { width: 640, height: 360 },
      'http://localhost:10302/eceee-media/image.png',
      { maxWidth: 320, maxHeight: 180, resizeType: 'fit' },
    );

    expect(result?.src).toContain('/resize:fit:320:180/');
    const encodedSource = result?.src.split('/').at(-1) || '';
    expect(Buffer.from(encodedSource, 'base64url').toString())
      .toBe('http://host.docker.internal:10302/eceee-media/image.png');
  });
});
