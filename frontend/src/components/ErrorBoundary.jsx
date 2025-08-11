import React from 'react'

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        // Optional: log to monitoring here
        if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error('ErrorBoundary caught error', error, errorInfo)
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="container mx-auto px-4 py-8">
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                        <div className="font-semibold mb-1">Something went wrong.</div>
                        <div className="text-sm">Please reload the page or try again later.</div>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}


