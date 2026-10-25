import apiClient from './client'
import { convertKeysToCamel, camelToSnake } from '../utils/caseConversion'

const base = '/api/v1/kanban/'
// This boundary owns Kanban's casing. Opaque text and IDs remain untouched.
const snake = (value) =>
    Array.isArray(value)
        ? value.map(snake)
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, child]) => [camelToSnake(key), snake(child)]))
          : value
export const kanbanApi = {
    async cards(params = {}) {
        const results = []
        let page = 1,
            response
        do {
            response = await kanbanApi.get('cards/', { ...params, page, pageSize: 500 })
            results.push(...response.results)
            page += 1
        } while (response.next)
        return { ...response, results }
    },
    async get(path, params = {}) {
        return convertKeysToCamel((await apiClient.get(base + path, { params: snake(params) })).data)
    },
    async post(path, data = {}) {
        return convertKeysToCamel((await apiClient.post(base + path, snake(data))).data)
    },
    async patch(path, data) {
        return convertKeysToCamel((await apiClient.patch(base + path, snake(data))).data)
    },
    async delete(path, data) {
        return convertKeysToCamel((await apiClient.delete(base + path, { data: snake(data) })).data)
    },
    async background(boardId) {
        return (await apiClient.get(`${base}boards/${boardId}/background/`, { responseType: 'blob' })).data
    },
    async uploadBackground(boardId, file, revision) {
        const body = new FormData()
        body.append('file', file)
        body.append('revision', revision)
        return convertKeysToCamel((await apiClient.post(`${base}boards/${boardId}/background/`, body, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })).data)
    },
    async upload(cardId, file, revision, comment) {
        const body = new FormData()
        body.append('file', file)
        body.append('revision', revision)
        if (comment) body.append('comment', comment)
        return convertKeysToCamel(
            (
                await apiClient.post(`${base}cards/${cardId}/attachments/`, body, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
            ).data,
        )
    },
    async blob(id) {
        return (
            await apiClient.get(`${base}attachments/${id}/download/`, {
                responseType: 'blob',
            })
        ).data
    },
}
export const attachmentUrl = (id, ticket = '') =>
    `${base}attachments/${id}/download/${ticket ? `?ticket=${encodeURIComponent(ticket)}` : ''}`
export const kanbanError = (error) =>
    error.response?.status === 409
        ? 'Någon har ändrat innehållet. Ladda om och försök igen. Din osparade text finns kvar.'
        : typeof error.response?.data === 'string'
          ? error.response.data
          : error.response?.data?.detail ||
            JSON.stringify(error.response?.data || error.message || 'Kunde inte spara. Försök igen.')

export const kanbanSocketUrl = (tenantId) => {
    const origin = import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`
    return `${origin.replace(/\/$/, '')}/ws/kanban/${tenantId}/`
}
