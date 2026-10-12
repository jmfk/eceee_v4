/*
 * Copyright (C) 2025 Johan Mats Fred Karlsson
 *
 * This file is part of easy_v4.
 *
 * This program is licensed under the Server Side Public License, version 1,
 * as published by MongoDB, Inc. See the LICENSE file for details.
 */

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import analytics from './utils/analytics'
import { getCurrentTenantId, subscribeToCurrentTenantId } from './utils/tenant'
import RenderFrameRuntime from './rendering/RenderFrameRuntime'
import StandaloneRenderRuntime from './rendering/StandaloneRenderRuntime'
import StandaloneVersionRenderRuntime from './rendering/StandaloneVersionRenderRuntime'

const isRenderFrame = window.location.pathname === '/__render-frame'
const isStandaloneRender = window.location.pathname.startsWith('/_render/')
const isStandaloneVersionRender = window.location.pathname.startsWith('/_render-version/')
if (!isRenderFrame && !isStandaloneRender && !isStandaloneVersionRender) {
    const initializeAnalytics = (tenantId) => {
        analytics.init(tenantId)
    }
    initializeAnalytics(getCurrentTenantId())
    subscribeToCurrentTenantId(initializeAnalytics)
}

const RootComponent = isRenderFrame
    ? RenderFrameRuntime
    : isStandaloneRender
        ? StandaloneRenderRuntime
        : isStandaloneVersionRender
            ? StandaloneVersionRenderRuntime
            : App

createRoot(document.getElementById('root')).render(<RootComponent />)
