/**
 * Color Extraction Utility
 * 
 * Client-side color extraction from images using Canvas API and median cut algorithm.
 * Provides functions for extracting dominant colors and color manipulation.
 */

/**
 * Convert RGB values to hex color string
 */
export const rgbToHex = (r, g, b) => {
  const toHex = (n) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Calculate Euclidean distance between two RGB colors
 */
export const colorDistance = (color1, color2) => {
  const rDiff = color1.r - color2.r;
  const gDiff = color1.g - color2.g;
  const bDiff = color1.b - color2.b;
  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
};

/**
 * Filter out similar colors based on distance threshold
 */
export const filterSimilarColors = (colors, threshold = 30) => {
  const filtered = [];

  for (const color of colors) {
    let isSimilar = false;
    for (const filteredColor of filtered) {
      if (colorDistance(color, filteredColor) < threshold) {
        isSimilar = true;
        break;
      }
    }
    if (!isSimilar) {
      filtered.push(color);
    }
  }

  return filtered;
};

/**
 * Get color name based on hue
 */
const getColorName = (r, g, b, index) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Grayscale detection
  if (delta < 20) {
    if (max > 200) return `extracted-light-gray-${index}`;
    if (max < 80) return `extracted-dark-gray-${index}`;
    return `extracted-gray-${index}`;
  }

  // Hue calculation
  let hue = 0;
  if (delta !== 0) {
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  // Name based on hue ranges
  if (hue < 15 || hue >= 345) return `extracted-red-${index}`;
  if (hue < 45) return `extracted-orange-${index}`;
  if (hue < 75) return `extracted-yellow-${index}`;
  if (hue < 150) return `extracted-green-${index}`;
  if (hue < 210) return `extracted-cyan-${index}`;
  if (hue < 270) return `extracted-blue-${index}`;
  if (hue < 330) return `extracted-purple-${index}`;
  return `extracted-magenta-${index}`;
};

/**
 * Color bucket for median cut algorithm
 */
class ColorBucket {
  constructor(pixels) {
    this.pixels = pixels;
    this.calculateRange();
  }

  calculateRange() {
    let rMin = 255, rMax = 0;
    let gMin = 255, gMax = 0;
    let bMin = 255, bMax = 0;

    for (const pixel of this.pixels) {
      rMin = Math.min(rMin, pixel.r);
      rMax = Math.max(rMax, pixel.r);
      gMin = Math.min(gMin, pixel.g);
      gMax = Math.max(gMax, pixel.g);
      bMin = Math.min(bMin, pixel.b);
      bMax = Math.max(bMax, pixel.b);
    }

    this.rRange = rMax - rMin;
    this.gRange = gMax - gMin;
    this.bRange = bMax - bMin;
  }

  getWidestChannel() {
    if (this.rRange >= this.gRange && this.rRange >= this.bRange) {
      return 'r';
    } else if (this.gRange >= this.bRange) {
      return 'g';
    } else {
      return 'b';
    }
  }

  split() {
    const channel = this.getWidestChannel();
    this.pixels.sort((a, b) => a[channel] - b[channel]);

    const medianIndex = Math.floor(this.pixels.length / 2);
    const bucket1 = new ColorBucket(this.pixels.slice(0, medianIndex));
    const bucket2 = new ColorBucket(this.pixels.slice(medianIndex));

    return [bucket1, bucket2];
  }

  getAverageColor() {
    let rSum = 0, gSum = 0, bSum = 0;

    for (const pixel of this.pixels) {
      rSum += pixel.r * pixel.count;
      gSum += pixel.g * pixel.count;
      bSum += pixel.b * pixel.count;
    }

    const totalCount = this.pixels.reduce((sum, p) => sum + p.count, 0);

    return {
      r: Math.round(rSum / totalCount),
      g: Math.round(gSum / totalCount),
      b: Math.round(bSum / totalCount),
      count: totalCount
    };
  }
}

/**
 * Cluster colors based on similarity
 * @param {Array} colors - Array of color objects with r, g, b, count
 * @param {number} threshold - Distance threshold for clustering (0-255)
 * @returns {Array} Array of clusters with representative colors
 */
const clusterColors = (colors, threshold = 15) => {
  const clusters = [];

  for (const color of colors) {
    let addedToCluster = false;

    // Try to add to existing cluster
    for (const cluster of clusters) {
      if (colorDistance(color, cluster.representative) < threshold) {
        cluster.colors.push(color);
        cluster.totalCount += color.count;
        // Update representative to most frequent color in cluster
        if (color.count > cluster.representative.count) {
          cluster.representative = color;
        }
        addedToCluster = true;
        break;
      }
    }

    // Create new cluster if no match found
    if (!addedToCluster) {
      clusters.push({
        representative: color,
        colors: [color],
        totalCount: color.count
      });
    }
  }

  return clusters;
};

/**
 * Extract dominant colors from an image using color clustering
 * @param {File} imageFile - The image file to extract colors from
 * @param {number} maxColors - Maximum number of colors to extract (acts as a limiter)
 * @param {number} clusteringDistance - Distance threshold for clustering similar colors (0-255)
 * @returns {Object} Object with colors array and statistics
 */
export const extractColorsFromImage = async (imageFile, maxColors = 8, clusteringDistance = 15) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      try {
        // Resize image if too large for performance
        const maxDimension = 400;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        // Build color histogram
        const colorMap = new Map();
        let totalPixels = 0;

        // Sample every nth pixel for performance
        const sampleRate = Math.max(1, Math.floor(pixels.length / (4 * 10000)));

        for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          // Skip very light colors (near white)
          if (r > 245 && g > 245 && b > 245) continue;

          // Skip very dark colors (near black)
          if (r < 10 && g < 10 && b < 10) continue;

          totalPixels++;
          const key = `${r},${g},${b}`;
          if (colorMap.has(key)) {
            colorMap.get(key).count++;
          } else {
            colorMap.set(key, { r, g, b, count: 1 });
          }
        }

        // Convert map to array
        const allColors = Array.from(colorMap.values());
        const totalDistinctColors = allColors.length;

        if (allColors.length === 0) {
          resolve({
            colors: [],
            stats: {
              totalDistinctColors: 0,
              clusteredColors: 0,
              returnedColors: 0
            }
          });
          return;
        }

        // Sort by frequency (most common first)
        allColors.sort((a, b) => b.count - a.count);

        // Cluster similar colors together (groups anti-aliasing with parent colors)
        const clusters = clusterColors(allColors, clusteringDistance);
        const clusteredColors = clusters.length;

        // Extract representative color from each cluster
        let colors = clusters.map(cluster => ({
          r: cluster.representative.r,
          g: cluster.representative.g,
          b: cluster.representative.b,
          count: cluster.totalCount
        }));

        // Filter out background colors
        colors = colors.filter(color => {
          // Remove near-white (light backgrounds)
          if (color.r > 240 && color.g > 240 && color.b > 240) return false;

          // Remove near-black (dark backgrounds)
          if (color.r < 10 && color.g < 10 && color.b < 10) return false;

          // Remove pure grays (R ≈ G ≈ B with low color variation)
          const avg = (color.r + color.g + color.b) / 3;
          const maxDiff = Math.max(
            Math.abs(color.r - avg),
            Math.abs(color.g - avg),
            Math.abs(color.b - avg)
          );
          if (maxDiff < 10) return false; // Very gray

          return true;
        });

        // Sort by frequency
        colors.sort((a, b) => b.count - a.count);

        // Take up to maxColors (but could be fewer if not enough distinct colors)
        const returnedColors = Math.min(colors.length, maxColors);
        colors = colors.slice(0, returnedColors);

        // Convert to final format with names and frequency
        const result = colors.map((color, i) => ({
          r: color.r,
          g: color.g,
          b: color.b,
          hex: rgbToHex(color.r, color.g, color.b),
          name: getColorName(color.r, color.g, color.b, i + 1),
          frequency: (color.count / totalPixels * 100).toFixed(2)
        }));

        resolve({
          colors: result,
          stats: {
            totalDistinctColors,
            clusteredColors,
            returnedColors
          }
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(imageFile);
  });
};

