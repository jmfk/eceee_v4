import { describe, it, expect } from 'vitest'

// Emulate the URL building logic from PagePreview.tsx
const buildPreviewUrl = (hostname, previewPath, isDev, windowPort) => {
    const protocol = isDev ? 'http' : 'https';
    
    let effectiveHostname = hostname;
    if (isDev && hostname && !hostname.includes(':')) {
        const currentPort = windowPort;
        if (currentPort) {
            effectiveHostname = `${hostname}:${currentPort}`;
        }
    }

    let previewUrl = effectiveHostname
        ? `${protocol}://${effectiveHostname}${previewPath}`
        : previewPath;
        
    return previewUrl;
}

describe('PagePreview - URL Construction Logic', () => {
    const previewPath = '/api/v1/webpages/pages/1/versions/1/preview/';

    it('should build absolute URL with port in dev for bare hostname', () => {
        const hostname = 'summerstudy';
        const url = buildPreviewUrl(hostname, previewPath, true, '8000');
        expect(url).toBe(`http://summerstudy:8000${previewPath}`);
    });

    it('should preserve existing port in dev', () => {
        const hostname = 'localhost:8080';
        const url = buildPreviewUrl(hostname, previewPath, true, '3000');
        expect(url).toBe(`http://localhost:8080${previewPath}`);
    });

    it('should build absolute URL without port in prod for bare hostname', () => {
        const hostname = 'summerstudy.eceee.org';
        const url = buildPreviewUrl(hostname, previewPath, false, '8000');
        expect(url).toBe(`https://summerstudy.eceee.org${previewPath}`);
    });

    it('should fall back to relative path if no hostname', () => {
        const hostname = null;
        const url = buildPreviewUrl(hostname, previewPath, true, '8000');
        expect(url).toBe(previewPath);
    });
});
