import { startReportDiagnostics } from './utils/reportDiagnostics'
/*
 * Copyright (C) 2025 Johan Mats Fred Karlsson
 *
 * This file is part of easy_v4.
 *
 * This program is licensed under the Server Side Public License, version 1,
 * as published by MongoDB, Inc. See the LICENSE file for details.
 */

const isRenderFrame = window.location.pathname === '/__render-frame'
const isStandaloneRender = window.location.pathname.startsWith('/_render/')
const isStandaloneVersionRender = window.location.pathname.startsWith('/_render-version/')

const bootstrap = isRenderFrame || isStandaloneRender || isStandaloneVersionRender
    ? import('./rendering/renderBootstrap')
    : import('./editorBootstrap')

bootstrap.catch((error) => {
    console.error('Application bootstrap failed', error)
})

startReportDiagnostics()
