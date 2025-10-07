/**
 * Custom Footer Widget - ECEEE-specific override of the default FooterWidget
 * 
 * This widget demonstrates how to override a default widget with an ECEEE-specific implementation.
 * It uses the same widget type 'default_widgets.FooterWidget' to replace the default FooterWidget.
 */

import React from 'react';
import { Heart, Globe, Mail, Phone } from 'lucide-react';

const eceeeFooterWidget = ({
    config = {},
    editable = false,
    onConfigChange,
    onAction,
    pageContext = {}
}) => {
    const {
        companyName = 'ECEEE',
        tagline = 'European Council for an Energy Efficient Economy',
        showSocialLinks = true,
        showContactInfo = true,
        backgroundColor = '#1f2937',
        textColor = '#f9fafb',
        accentColor = '#3b82f6'
    } = config;

    const handleConfigUpdate = (updates) => {
        if (onConfigChange) {
            onConfigChange({ ...config, ...updates });
        }
    };

    if (editable) {
        return (
            <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        ECEEE Custom Footer Widget
                    </h3>
                    <p className="text-sm text-gray-600">
                        This is a custom ECEEE footer that overrides the default footer widget.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Company Name
                        </label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => handleConfigUpdate({ companyName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tagline
                        </label>
                        <input
                            type="text"
                            value={tagline}
                            onChange={(e) => handleConfigUpdate({ tagline: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={showSocialLinks}
                                onChange={(e) => handleConfigUpdate({ showSocialLinks: e.target.checked })}
                                className="mr-2"
                            />
                            Show Social Links
                        </label>

                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={showContactInfo}
                                onChange={(e) => handleConfigUpdate({ showContactInfo: e.target.checked })}
                                className="mr-2"
                            />
                            Show Contact Info
                        </label>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Background Color
                            </label>
                            <input
                                type="color"
                                value={backgroundColor}
                                onChange={(e) => handleConfigUpdate({ backgroundColor: e.target.value })}
                                className="w-full h-10 border border-gray-300 rounded-md"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Text Color
                            </label>
                            <input
                                type="color"
                                value={textColor}
                                onChange={(e) => handleConfigUpdate({ textColor: e.target.value })}
                                className="w-full h-10 border border-gray-300 rounded-md"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Accent Color
                            </label>
                            <input
                                type="color"
                                value={accentColor}
                                onChange={(e) => handleConfigUpdate({ accentColor: e.target.value })}
                                className="w-full h-10 border border-gray-300 rounded-md"
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <footer
            className="py-12 px-6"
            style={{ backgroundColor, color: textColor }}
        >
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Company Info */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-2xl font-bold mb-2" style={{ color: accentColor }}>
                                {companyName}
                            </h3>
                            <p className="text-sm opacity-90">
                                {tagline}
                            </p>
                        </div>

                        <div className="flex items-center space-x-2 text-sm">
                            <Heart className="h-4 w-4" style={{ color: accentColor }} />
                            <span>Promoting energy efficiency across Europe</span>
                        </div>
                    </div>

                    {/* Contact Info */}
                    {showContactInfo && (
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold" style={{ color: accentColor }}>
                                Contact Us
                            </h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center space-x-2">
                                    <Mail className="h-4 w-4" />
                                    <span>info@eceee.org</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Phone className="h-4 w-4" />
                                    <span>+46 8 753 24 50</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Globe className="h-4 w-4" />
                                    <span>Stockholm, Sweden</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Social Links */}
                    {showSocialLinks && (
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold" style={{ color: accentColor }}>
                                Follow Us
                            </h4>
                            <div className="flex space-x-4">
                                <a
                                    href="#"
                                    className="hover:opacity-75 transition-opacity"
                                    style={{ color: accentColor }}
                                >
                                    LinkedIn
                                </a>
                                <a
                                    href="#"
                                    className="hover:opacity-75 transition-opacity"
                                    style={{ color: accentColor }}
                                >
                                    Twitter
                                </a>
                                <a
                                    href="#"
                                    className="hover:opacity-75 transition-opacity"
                                    style={{ color: accentColor }}
                                >
                                    Newsletter
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Copyright */}
                <div className="mt-8 pt-8 border-t border-opacity-20" style={{ borderColor: textColor }}>
                    <div className="flex flex-col md:flex-row justify-between items-center text-sm opacity-75">
                        <p>© 2024 {companyName}. All rights reserved.</p>
                        <p>Custom ECEEE Footer Widget Override</p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

// Widget metadata
eceeeFooterWidget.displayName = 'FooterWidget';
eceeeFooterWidget.widgetType = 'eceee_widgets.FooterWidget'; // Same type as default to override it

eceeeFooterWidget.defaultConfig = {
    companyName: 'ECEEE',
    tagline: 'European Council for an Energy Efficient Economy',
    showSocialLinks: true,
    showContactInfo: true,
    backgroundColor: '#1f2937',
    textColor: '#f9fafb',
    accentColor: '#3b82f6'
};

eceeeFooterWidget.metadata = {
    name: 'ECEEE Footer',
    description: 'Custom ECEEE footer with company branding and contact information',
    category: 'layout',
    icon: null,
    tags: ['footer', 'eceee', 'contact', 'branding'],
    menuItems: []
};

export default eceeeFooterWidget;
