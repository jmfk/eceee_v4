import { mockAxiosInstance } from './setup'

export const apiResponse = (data) => ({ data })

export const resetApiMocks = (defaultData = {}) => {
    mockAxiosInstance.get.mockReset()
    mockAxiosInstance.post.mockReset()
    mockAxiosInstance.put.mockReset()
    mockAxiosInstance.patch.mockReset()
    mockAxiosInstance.delete.mockReset()

    mockAxiosInstance.get.mockResolvedValue(apiResponse(defaultData))
    mockAxiosInstance.post.mockResolvedValue(apiResponse(defaultData))
    mockAxiosInstance.put.mockResolvedValue(apiResponse(defaultData))
    mockAxiosInstance.patch.mockResolvedValue(apiResponse(defaultData))
    mockAxiosInstance.delete.mockResolvedValue(apiResponse(defaultData))

    return mockAxiosInstance
}

export const mockApiPending = (method = 'get') => {
    mockAxiosInstance[method].mockImplementation(() => new Promise(() => { }))
}

export { mockAxiosInstance }
