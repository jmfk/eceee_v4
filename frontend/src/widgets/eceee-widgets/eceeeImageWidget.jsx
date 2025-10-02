/**
 * ECEEE Image Widget
 * 
 * ECEEE-specific implementation of the Image widget.
 * Widget type: eceee_widgets.ImageWidget
 */

import React from 'react';
import ImageWidget from '../default-widgets/ImageWidget';

const eceeeImageWidget = (props) => {
    // Use the default ImageWidget component but with eceee_widgets namespace
    return <ImageWidget {...props} />;
};

// Widget metadata
eceeeImageWidget.displayName = 'ECEEE Image';
eceeeImageWidget.widgetType = 'eceee_widgets.ImageWidget';

eceeeImageWidget.defaultConfig = {
    mediaItems: [],
    displayType: 'gallery',
    imageStyle: null,
    enableLightbox: true,
    showCaptions: true,
    autoPlay: false,
    autoPlayInterval: 3,
    collectionId: null,
    collectionConfig: null
};

eceeeImageWidget.metadata = {
    name: 'ECEEE Image',
    description: 'ECEEE-specific image widget with gallery and carousel support',
    category: 'media',
    icon: null,
    tags: ['image', 'gallery', 'carousel', 'eceee'],
    menuItems: [],
    specialEditor: 'MediaSpecialEditor' // Declare which special editor to use
};

export default eceeeImageWidget;

