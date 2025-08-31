/**
 * Field Types API Client
 * 
 * Provides API methods for managing field types in the schema system.
 */

import { api } from './client.js'
import { convertKeysToCamel, convertKeysToSnake } from '../utils/caseConversion.js'

const BASE_URL = '/api/v1/utils'

export const fieldTypesApi = {
    /**
     * Get all available field types
     */
    async getAll() {
        const response = await api.get(`${BASE_URL}/field-types/`)
        return {
            ...response,
            data: {
                ...response.data,
                fieldTypes: response.data.fieldTypes.map(convertKeysToCamel)
            }
        }
    },

    /**
     * Register a new custom field type
     */
    async register(fieldTypeData) {
        const snakeCaseData = convertKeysToSnake(fieldTypeData)
        const response = await api.post(`${BASE_URL}/field-types/register/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    }
}

export default fieldTypesApi
