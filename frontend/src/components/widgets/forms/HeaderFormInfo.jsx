/**
 * Header Widget Configuration Info
 * 
 * Informational component for header widget - directs users to theme editor
 * since header styling is now managed via design groups.
 */

import React from 'react';
import { Info, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HeaderFormInfo = ({ themeId }) => {
    const navigate = useNavigate();

    const handleNavigateToTheme = () => {
        if (themeId) {
            navigate(`/settings/themes/${themeId}`);
        } else {
            navigate('/settings/themes');
        }
    };

    return (
        <div className="p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                    <Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <div className="text-lg font-semibold text-blue-900 mb-2">
                            Header Configuration Moved to Theme
                        </div>
                        <div className="text-sm text-blue-800 space-y-2">
                            <p>
                                Header images, dimensions, and styling are now configured in the theme's 
                                <strong> Design Groups</strong> section. This allows you to:
                            </p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Define responsive header images for all breakpoints (mobile, tablet, desktop)</li>
                                <li>Set header heights and styling per breakpoint</li>
                                <li>Apply consistent header styling across your entire site</li>
                                <li>Switch header appearance instantly by changing themes</li>
                            </ul>
                            <p className="mt-4">
                                To configure your header, go to <strong>Theme Editor → Design Groups</strong> and 
                                create or edit a design group targeting the <code className="px-1 py-0.5 bg-blue-100 rounded">HeaderWidget</code>.
                            </p>
                        </div>
                        <div className="mt-4">
                            <button
                                onClick={handleNavigateToTheme}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Go to Theme Editor
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

HeaderFormInfo.displayName = 'HeaderFormInfo';

export default HeaderFormInfo;

