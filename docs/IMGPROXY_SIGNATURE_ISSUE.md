# imgproxy Signature Issue - To Be Resolved

## Status
- ✅ imgproxy is working correctly with `IMGPROXY_ALLOW_UNSAFE_URL: true`
- ✅ Template tags are working correctly  
- ✅ Images are displaying properly
- ❌ Signed URLs are not working (signature validation fails)

## Current Configuration
`docker-compose.yml` has been temporarily modified:
- `IMGPROXY_ALLOW_UNSAFE_URL: true` (development only)
- Keys are commented out temporarily

## What Works
- Unsigned URLs: `/unsafe/resize:fit:800:600/[encoded_url]` ✅
- Image access from MinIO ✅
- Image processing (resize, crop, etc.) ✅
- Template tag integration ✅

## What Doesn't Work
- Signed URLs with HMAC-SHA256 signatures ❌
- Even with keys set and matching the official imgproxy Python example

## Investigation Summary

1. **Signature Generation**: Updated to match official imgproxy example exactly:
   ```python
   digest = hmac.new(key, msg=salt+path, digestmod=hashlib.sha256).digest()
   signature = base64.urlsafe_b64encode(digest).decode().rstrip("=")
   ```

2. **Keys**: Using the same keys in both Django and imgproxy:
   - Key: `943b421c9eb07c830af81030552c86009268de4e532ba2ee2eab8247c6da0881`
   - Salt: `520f986b998545b4785e0defbc4f3c1203f22de2374a3d53cb7a7fe9fea309c5`

3. **Test Results**:
   - Unsigned URL (keys disabled): **200 OK** ✅
   - Signed URL (keys enabled): **403 Invalid signature** ❌
   - Both tested with same source image

## Possible Causes

1. **Key Format Issue**: imgproxy might expect keys in a different format
2. **Signature Algorithm Mismatch**: Despite matching the official example, there might be a subtle difference
3. **imgproxy Version Issue**: The Docker image version might have different signature requirements
4. **Environment Variable Parsing**: imgproxy might not be reading the hex keys correctly

## Next Steps for Production

Before deploying to production, investigate and resolve:

1. Try generating new keys using imgproxy's recommended method:
   ```bash
   echo $(xxd -g 2 -l 64 -p /dev/random | tr -d '\n')
   ```

2. Test with different imgproxy versions

3. Compare with working imgproxy installations

4. Check imgproxy GitHub issues for similar problems

5. Consider using imgproxy's built-in URL signing helper if available

## Workaround for Development

Current setup with `IMGPROXY_ALLOW_UNSAFE_URL: true` is acceptable for development because:
- Local development environment only
- Not exposed to public internet
- Performance is good
- All features work correctly

## Security Note

**DO NOT** deploy to production with `IMGPROXY_ALLOW_UNSAFE_URL: true`. This allows anyone to use your imgproxy instance to process any image URL, potentially:
- Causing high bandwidth usage
- Enabling abuse/DDoS
- Processing malicious images

---

**Date**: October 2, 2025  
**Impact**: Low (development only)  
**Priority**: Medium (must fix before production)

