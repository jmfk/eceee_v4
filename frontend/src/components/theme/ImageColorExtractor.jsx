/**
 * ImageColorExtractor Component
 * 
 * Allows users to upload an image and extract dominant colors with:
 * - Automatic extraction when slider moves
 * - Interactive preview with color selection
 * - Remembers deselected colors between extractions
 * - Add or replace existing color palette
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, X, Loader, Image as ImageIcon, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { extractColorsFromImage } from '../../utils/colorExtraction';

const ImageColorExtractor = ({ onColorsExtracted, mode = 'add' }) => {
  // Helper function to categorize color by dominant channel
  const categorizeColor = (color) => {
    const { r, g, b } = color;
    
    // Check if grayscale (R ≈ G ≈ B)
    const maxDiff = Math.max(
      Math.abs(r - g),
      Math.abs(r - b),
      Math.abs(g - b)
    );
    
    if (maxDiff < 20) {
      return 'bw'; // Black/White category
    }
    
    // Find dominant channel
    if (r > g && r > b) return 'red';
    if (g > r && g > b) return 'green';
    if (b > r && b > g) return 'blue';
    
    // Edge case: ties
    if (r === g && r > b) return 'red';
    if (g === b && g > r) return 'green';
    return 'blue';
  };
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [maxColors, setMaxColors] = useState(8);
  const [sliderMax, setSliderMax] = useState(20);
  const [clusteringDistance, setClusteringDistance] = useState(15);
  const [extractedColors, setExtractedColors] = useState([]);
  const [colorStats, setColorStats] = useState(null);
  const [selectedColors, setSelectedColors] = useState(new Set());
  const [deselectedColorHexes, setDeselectedColorHexes] = useState(new Set());
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setExtractedColors([]);
    setSelectedColors(new Set());
    setDeselectedColorHexes(new Set());
  };

  const handleExtractColors = async () => {
    if (!image) return;

    setIsExtracting(true);
    try {
      const result = await extractColorsFromImage(image, maxColors, clusteringDistance);
      setExtractedColors(result.colors);
      setColorStats(result.stats);

      // Select all colors by default, except those previously deselected
      const newSelectedColors = new Set();
      result.colors.forEach((color, i) => {
        if (!deselectedColorHexes.has(color.hex)) {
          newSelectedColors.add(i);
        }
      });
      setSelectedColors(newSelectedColors);
    } catch (error) {
      console.error('Color extraction failed:', error);
      alert('Failed to extract colors. Please try another image.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Auto-extract when slider or clustering distance changes
  useEffect(() => {
    if (image) {
      handleExtractColors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxColors, clusteringDistance, image]);

  const toggleColorSelection = (index) => {
    const color = extractedColors[index];
    const newSelected = new Set(selectedColors);
    const newDeselected = new Set(deselectedColorHexes);

    if (newSelected.has(index)) {
      newSelected.delete(index);
      // Remember this color hex as deselected
      newDeselected.add(color.hex);
    } else {
      newSelected.add(index);
      // Remove from deselected list
      newDeselected.delete(color.hex);
    }

    setSelectedColors(newSelected);
    setDeselectedColorHexes(newDeselected);
  };

  const handleAddColors = () => {
    const colorsToAdd = extractedColors
      .filter((_, index) => selectedColors.has(index))
      .reduce((acc, color) => {
        acc[color.name] = color.hex;
        return acc;
      }, {});

    if (Object.keys(colorsToAdd).length === 0) {
      alert('Please select at least one color to add');
      return;
    }

    onColorsExtracted(colorsToAdd, 'add');
    handleReset();
  };

  const handleReplaceColors = () => {
    const colorsToAdd = extractedColors
      .filter((_, index) => selectedColors.has(index))
      .reduce((acc, color) => {
        acc[color.name] = color.hex;
        return acc;
      }, {});

    if (Object.keys(colorsToAdd).length === 0) {
      alert('Please select at least one color to replace with');
      return;
    }

    onColorsExtracted(colorsToAdd, 'replace');
    handleReset();
  };

  const handleReset = () => {
    setImage(null);
    setImagePreview(null);
    setExtractedColors([]);
    setSelectedColors(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Categorize and sort colors by RGB channels
  const categorizedColors = useMemo(() => {
    const categories = { red: [], green: [], blue: [], bw: [] };
    
    extractedColors.forEach((color, index) => {
      const category = categorizeColor(color);
      categories[category].push({ ...color, originalIndex: index });
    });
    
    // Sort each category by intensity
    categories.red.sort((a, b) => b.r - a.r);
    categories.green.sort((a, b) => b.g - a.g);
    categories.blue.sort((a, b) => b.b - a.b);
    categories.bw.sort((a, b) => (b.r + b.g + b.b) - (a.r + a.g + a.b));
    
    return categories;
  }, [extractedColors]);

  return (
    <div className="space-y-4">
      {/* Image Upload */}
      {!imagePreview && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Image
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
            <ImageIcon className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-3">
              Upload an image to extract colors
            </p>
            <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 mr-2" />
              Choose Image
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Settings & Statistics */}
      {imagePreview && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
          <div className="grid grid-cols-3 gap-3">
            {/* Thumbnail */}
            <div className="flex flex-col items-center justify-center">
              <img
                src={imagePreview}
                alt="Thumbnail"
                className="w-16 h-16 object-contain rounded border border-gray-300 bg-white"
              />
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-red-600 hover:text-red-700 mt-1"
                title="Remove image"
              >
                <X className="w-3 h-3 inline" />
              </button>
            </div>

            {/* Middle Column: Controls */}
            <div className="space-y-2">
              {/* Max Colors */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">
                    Max Colors: {maxColors}
                  </label>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setMaxColors(Math.max(1, maxColors - 1))}
                      disabled={isExtracting || maxColors <= 1}
                      className="p-0.5 bg-gray-300 hover:bg-gray-400 rounded disabled:opacity-50 text-xs"
                      title="Decrease max colors"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaxColors(Math.max(1, Math.min(sliderMax, maxColors + 1)))}
                      disabled={isExtracting || maxColors >= sliderMax}
                      className="p-0.5 bg-gray-300 hover:bg-gray-400 rounded disabled:opacity-50 text-xs"
                      title="Increase max colors"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Maximum number to extract (limit: {sliderMax})
                </p>
              </div>

              {/* Clustering Distance */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">
                    Cluster: {clusteringDistance}
                  </label>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setClusteringDistance(Math.max(1, clusteringDistance - 1))}
                      disabled={isExtracting || clusteringDistance <= 1}
                      className="p-0.5 bg-gray-300 hover:bg-gray-400 rounded disabled:opacity-50 text-xs"
                      title="Decrease (more colors)"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setClusteringDistance(Math.min(100, clusteringDistance + 1))}
                      disabled={isExtracting || clusteringDistance >= 100}
                      className="p-0.5 bg-gray-300 hover:bg-gray-400 rounded disabled:opacity-50 text-xs"
                      title="Increase (fewer colors)"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Groups colors within {clusteringDistance} units
                </p>
              </div>
            </div>

            {/* Right Column: Statistics */}
            <div className="flex flex-col justify-center">
              {isExtracting ? (
                <div className="flex items-center justify-center text-gray-500 text-xs py-4">
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Extracting...
                </div>
              ) : colorStats ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-900 mb-2">Statistics</p>
                  <div className="space-y-1 text-xs text-gray-700">
                    <div className="flex justify-between">
                      <span>Found:</span>
                      <span className="font-medium">{colorStats.totalDistinctColors}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Clustered:</span>
                      <span className="font-medium">{colorStats.clusteredColors}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Showing:</span>
                      <span className="font-medium">{colorStats.returnedColors}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Extracted Colors Preview */}
      {extractedColors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Extracted Colors ({selectedColors.size} selected)
            </label>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {/* Red Column */}
            <div>
              <h5 className="text-xs font-semibold text-red-600 mb-2">Red ({categorizedColors.red.length})</h5>
              <div className="space-y-1.5">
                {categorizedColors.red.map((color) => {
                  const isSelected = selectedColors.has(color.originalIndex);
                  return (
                    <div
                      key={color.originalIndex}
                      onClick={() => toggleColorSelection(color.originalIndex)}
                      className={`relative cursor-pointer rounded border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 shadow-md'
                          : 'border-gray-300 opacity-50'
                      }`}
                      title={`${color.name} - ${color.hex} (${color.frequency}%)`}
                    >
                      <div className="flex flex-col items-center p-1.5">
                        <div
                          className="w-full h-12 rounded border border-gray-300 mb-1"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="w-full text-center">
                          <p className="text-[9px] leading-tight text-gray-900">
                            R:{color.r} G:{color.g} B:{color.b}
                          </p>
                          {color.frequency && (
                            <p className="text-[10px] leading-tight text-gray-500 font-medium mt-0.5">{color.frequency}%</p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="absolute top-0.5 right-0.5 bg-blue-500 text-white rounded-full p-0.5">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Green Column */}
            <div>
              <h5 className="text-xs font-semibold text-green-600 mb-2">Green ({categorizedColors.green.length})</h5>
              <div className="space-y-1.5">
                {categorizedColors.green.map((color) => {
                  const isSelected = selectedColors.has(color.originalIndex);
                  return (
                    <div
                      key={color.originalIndex}
                      onClick={() => toggleColorSelection(color.originalIndex)}
                      className={`relative cursor-pointer rounded border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 shadow-md'
                          : 'border-gray-300 opacity-50'
                      }`}
                      title={`${color.name} - ${color.hex} (${color.frequency}%)`}
                    >
                      <div className="flex flex-col items-center p-1.5">
                        <div
                          className="w-full h-12 rounded border border-gray-300 mb-1"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="w-full text-center">
                          <p className="text-[9px] leading-tight text-gray-900">
                            R:{color.r} G:{color.g} B:{color.b}
                          </p>
                          {color.frequency && (
                            <p className="text-[10px] leading-tight text-gray-500 font-medium mt-0.5">{color.frequency}%</p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="absolute top-0.5 right-0.5 bg-blue-500 text-white rounded-full p-0.5">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Blue Column */}
            <div>
              <h5 className="text-xs font-semibold text-blue-600 mb-2">Blue ({categorizedColors.blue.length})</h5>
              <div className="space-y-1.5">
                {categorizedColors.blue.map((color) => {
                  const isSelected = selectedColors.has(color.originalIndex);
                  return (
                    <div
                      key={color.originalIndex}
                      onClick={() => toggleColorSelection(color.originalIndex)}
                      className={`relative cursor-pointer rounded border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 shadow-md'
                          : 'border-gray-300 opacity-50'
                      }`}
                      title={`${color.name} - ${color.hex} (${color.frequency}%)`}
                    >
                      <div className="flex flex-col items-center p-1.5">
                        <div
                          className="w-full h-12 rounded border border-gray-300 mb-1"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="w-full text-center">
                          <p className="text-[9px] leading-tight text-gray-900">
                            R:{color.r} G:{color.g} B:{color.b}
                          </p>
                          {color.frequency && (
                            <p className="text-[10px] leading-tight text-gray-500 font-medium mt-0.5">{color.frequency}%</p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="absolute top-0.5 right-0.5 bg-blue-500 text-white rounded-full p-0.5">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Black/White Column */}
            <div>
              <h5 className="text-xs font-semibold text-gray-600 mb-2">B/W ({categorizedColors.bw.length})</h5>
              <div className="space-y-1.5">
                {categorizedColors.bw.map((color) => {
                  const isSelected = selectedColors.has(color.originalIndex);
                  return (
                    <div
                      key={color.originalIndex}
                      onClick={() => toggleColorSelection(color.originalIndex)}
                      className={`relative cursor-pointer rounded border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 shadow-md'
                          : 'border-gray-300 opacity-50'
                      }`}
                      title={`${color.name} - ${color.hex} (${color.frequency}%)`}
                    >
                      <div className="flex flex-col items-center p-1.5">
                        <div
                          className="w-full h-12 rounded border border-gray-300 mb-1"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="w-full text-center">
                          <p className="text-[9px] leading-tight text-gray-900">
                            R:{color.r} G:{color.g} B:{color.b}
                          </p>
                          {color.frequency && (
                            <p className="text-[10px] leading-tight text-gray-500 font-medium mt-0.5">{color.frequency}%</p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="absolute top-0.5 right-0.5 bg-blue-500 text-white rounded-full p-0.5">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleAddColors}
              disabled={selectedColors.size === 0}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Selected ({selectedColors.size})
            </button>
            <button
              type="button"
              onClick={handleReplaceColors}
              disabled={selectedColors.size === 0}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Replace All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageColorExtractor;

