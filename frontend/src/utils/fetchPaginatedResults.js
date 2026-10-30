export const fetchPaginatedResults = async fetchPage => {
    const items = []
    let page = 1

    while (true) {
        const response = await fetchPage(page)
        const results = Array.isArray(response) ? response : response?.results
        if (!Array.isArray(results)) throw new Error('Unexpected paginated media response')
        items.push(...results)
        if (!response?.next) return items
        page += 1
    }
}
