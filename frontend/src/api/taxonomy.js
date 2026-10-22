import { api } from './client'

const base = '/api/v1/taxonomy/'
const data = response => response.data
const query = params => new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')).toString()

export const taxonomyApi = {
    members: async typeId => data(await api.get(`${base}types/${typeId}/members/`)),
    defaultNamespace: async () => data(await api.get('/api/v1/namespaces/?is_default=true')),
    namespaces: async () => data(await api.get('/api/v1/namespaces/?page_size=200')),
    objectTypes: async () => data(await api.get('/api/v1/objects/object-types/?page_size=200')),
    types: async params => data(await api.get(`${base}types/?${query(params || {})}`)),
    terms: async params => data(await api.get(`${base}terms/?${query(params || {})}`)),
    usage: async id => data(await api.get(`${base}terms/${id}/usage/`)),
    term: async id => data(await api.get(`${base}terms/${id}/`)),
    createType: async values => data(await api.post(`${base}types/`, values)),
    create: async (typeId, payload) => data(await api.post(`${base}terms/`, { classification_type: typeId, payload })),
    change: async (term, action, payload = {}) => data(await api.post(`${base}terms/${term.id}/${action}/`, { revision: term.revision, payload })),
    propose: async (typeId, action, payload, term) => data(await api.post(`${base}proposals/`, {
        classification_type: typeId, action, payload, term: term?.id, revision: term?.revision,
    })),
    proposals: async params => data(await api.get(`${base}proposals/?${query(params || {})}`)),
    decide: async (id, decision, reason) => data(await api.post(`${base}proposals/${id}/decide/`, { decision, reason })),
    history: async params => data(await api.get(`${base}history/?${query(params || {})}`)),
    undo: async id => data(await api.post(`${base}history/${id}/restore/`, {})),
    grants: async typeId => data(await api.get(`${base}grants/?classification_type=${typeId}`)),
    grant: async (typeId, user, permissions) => data(await api.post(`${base}grants/`, { classification_type: typeId, user, permissions })),
    configure: async (type, values) => data(await api.post(`${base}types/${type.id}/configure/`, { revision: type.revision, ...values })),
}

export function classificationError(error) {
    const detail = error?.response?.data
    const messages = value => {
        if (typeof value === 'string') return [value]
        if (Array.isArray(value)) return value.flatMap(messages)
        if (value && typeof value === 'object') return Object.values(value).flatMap(messages)
        return []
    }
    return messages(detail).join(' ') || error?.message || 'Could not save. Try again.'
}
