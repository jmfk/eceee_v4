/**
 * File Manager API Client
 * 
 * API functions for file manager operations including table imports.
 */

import client from './client'

/**
 * Import table data from CSV or Excel file
 * @param {File} file - The file to upload (CSV or Excel)
 * @returns {Promise<Object>} - TableWidget configuration
 */
export const importTableFromFile = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await client.post('/file-manager/import-table/', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })

    return response.data
}

