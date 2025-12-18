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

// Initialize analytics with default tenant
// In production, this would come from a global config or the server
analytics.init('default');

createRoot(document.getElementById('root')).render(
  <App />,
)
