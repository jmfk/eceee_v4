import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import DesignerLayoutWorkspacePage from '../DesignerLayoutWorkspacePage'

vi.mock('react-router-dom', () => ({ useParams: () => ({ themeId: '7' }) }))
vi.mock('../../components/DesignerNavbar', () => ({ default: () => <nav>Designer navigation</nav> }))
vi.mock('../../components/StatusBar', () => ({ default: ({ customStatusContent }) => <footer>{customStatusContent}</footer> }))
vi.mock('../LayoutWorkspacePage', () => ({
    default: (props) => <div
        data-testid="layout-workspace"
        data-back-path={props.backPath}
        data-back-label={props.backLabel}
        data-document-title={props.documentTitle}
        data-fill-available-space={String(props.fillAvailableSpace)}
    />,
}))

describe('DesignerLayoutWorkspacePage', () => {
    it('keeps layout editing inside the Designer navigation hierarchy', () => {
        render(<DesignerLayoutWorkspacePage />)

        const workspace = screen.getByTestId('layout-workspace')
        expect(workspace).toHaveAttribute('data-back-path', '/designer/themes/7')
        expect(workspace).toHaveAttribute('data-back-label', 'Theme Designer')
        expect(workspace).toHaveAttribute('data-document-title', 'Designer - Layout Editor')
        expect(workspace).toHaveAttribute('data-fill-available-space', 'true')
        expect(screen.getByText('Designer navigation')).toBeInTheDocument()
        expect(screen.getByText('Designer · Layout Editor')).toBeInTheDocument()
    })
})
