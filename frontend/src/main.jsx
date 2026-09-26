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
import { getCurrentTenantId } from './utils/tenant'
import RenderFrameRuntime from './rendering/RenderFrameRuntime'
import StandaloneRenderRuntime from './rendering/StandaloneRenderRuntime'

const isRenderFrame = window.location.pathname === '/__render-frame'
const isStandaloneRender = window.location.pathname.startsWith('/_render/')
if (!isRenderFrame && !isStandaloneRender) analytics.init(getCurrentTenantId());

const RootComponent = isRenderFrame
    ? RenderFrameRuntime
    : isStandaloneRender
        ? StandaloneRenderRuntime
        : App

createRoot(document.getElementById('root')).render(<RootComponent />)
