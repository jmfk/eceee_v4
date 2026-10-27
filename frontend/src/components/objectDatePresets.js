const dateString = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const shifted = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

export const datePresets = (now = new Date()) => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = shifted(today, -((today.getDay() + 6) % 7))
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const previousMonthEnd = shifted(monthStart, -1)
    const rollingMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), previousMonthEnd.getDate()))
    const range = (label, from, to) => ({ label, values: [dateString(from), dateString(to)] })

    return [
        range('Today', today, today),
        range('Yesterday', shifted(today, -1), shifted(today, -1)),
        range('Last 7 days', shifted(today, -6), today),
        range('This week', weekStart, today),
        range('Previous week', shifted(weekStart, -7), shifted(weekStart, -1)),
        range('Last month', rollingMonthStart, today),
        range('Last 30 days', shifted(today, -29), today),
        range('This month', monthStart, today),
        range('Previous month', previousMonthStart, previousMonthEnd),
    ]
}
