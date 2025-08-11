import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../../components/ErrorBoundary'
import React from 'react'

function Boom() {
    throw new Error('boom')
}

describe('ErrorBoundary', () => {
    it('renders fallback UI when child throws', () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        )
        expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    })
})


