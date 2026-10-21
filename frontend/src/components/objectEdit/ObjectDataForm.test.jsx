import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useReducer } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useUnifiedData } from '../../contexts/unified-data'
import { renderWithStateProviders } from '../../test/testUtils'
import { createAppState } from '../../test/unifiedDataTestUtils'
import ObjectDataForm from './ObjectDataForm'

vi.mock('../../api', () => ({
    namespacesApi: {
        getDefault: vi.fn().mockResolvedValue({ slug: 'default' }),
    },
}))

vi.mock('../ObjectSchemaForm', () => ({
    default: ({ onChange, schema }) => (
        <>
            <div data-testid="schema-fields">{schema.fields.map(field => field.name).join(',')}</div>
            <button type="button" onClick={() => onChange('summary', 'Updated summary')}>
                Change schema field
            </button>
        </>
    ),
}))

const DirtyProbe = () => {
    const { getState, useExternalChanges } = useUnifiedData()
    const readDirty = () => String(getState().metadata.isDirty)
    const [, forceRender] = useReducer(value => value + 1, 0)

    useExternalChanges('object-data-dirty-probe', forceRender)

    return <>
        <div data-testid="dirty-state">{readDirty()}</div>
        <output data-testid="workflow-state">{JSON.stringify(getState().objects?.['object-1'])}</output>
    </>
}

const instance = {
    id: 'object-1',
    versionId: 99,
    editRevision: 7,
    parent: { id: 6 },
    title: 'Original title',
    status: 'draft',
    data: { summary: 'Original summary' },
    metadata: {},
    widgets: {},
    objectType: { id: 'type-1', name: 'article' },
}

const objectType = {
    id: 'type-1',
    name: 'article',
    label: 'Article',
    schema: {
        properties: {
            summary: { type: 'string', title: 'Summary' },
        },
    },
}

const renderForm = () => renderWithStateProviders(
    <>
        <ObjectDataForm objectType={objectType} instance={instance} />
        <DirtyProbe />
    </>,
    {
        initialState: createAppState({
            pages: {},
            versions: {},
            objects: { 'object-1': instance },
            metadata: {
                currentPageId: undefined,
                currentVersionId: undefined,
                currentObjectId: 'object-1',
            },
        }),
    },
)

describe('ObjectDataForm dirty state', () => {
    it('renders before a page-managed Object instance exists', async () => {
        await act(async () => { renderWithStateProviders(<ObjectDataForm objectType={objectType} initializeObject={false} />, {
            initialState: createAppState({ objects: {}, metadata: { currentObjectId: undefined } }),
        }) })
        expect(screen.getByPlaceholderText('Enter object title...')).toHaveValue('')
    })

    it('preserves the save version and parent when the data form initializes the object', async () => {
        renderForm()
        fireEvent.change(screen.getByPlaceholderText('Enter object title...'), {
            target: { value: 'Updated title' },
        })
        await waitFor(() => {
            const savedState = JSON.parse(screen.getByTestId('workflow-state').textContent)
            expect(savedState.currentVersionId).toBe('99')
            expect(savedState.editRevision).toBe(7)
            expect(savedState.parentId).toBe(6)
        })
    })

    it('marks a top-level object field dirty immediately', async () => {
        renderForm()
        await waitFor(() => expect(screen.getByTestId('dirty-state')).toHaveTextContent('false'))

        fireEvent.change(screen.getByPlaceholderText('Enter object title...'), {
            target: { value: 'Updated title' },
        })

        await waitFor(() => expect(screen.getByTestId('dirty-state')).toHaveTextContent('true'))
    })

    it('marks a schema field dirty before its debounced UDC update', async () => {
        renderForm()
        await waitFor(() => expect(screen.getByTestId('dirty-state')).toHaveTextContent('false'))

        fireEvent.click(screen.getByRole('button', { name: 'Change schema field' }))

        await waitFor(() => expect(screen.getByTestId('dirty-state')).toHaveTextContent('true'))
    })

    it('does not expose live object-reference fields in theme previews', async () => {
        const previewType = {
            ...objectType,
            schema: {
                properties: {
                    summary: { type: 'string', title: 'Summary' },
                    related: { type: 'array', componentType: 'object_reference' },
                    reverse: { type: 'array', field_type: 'reverse_object_reference' },
                },
            },
        }

        renderWithStateProviders(
            <ObjectDataForm
                objectType={previewType}
                instance={instance}
                context={{ mode: 'theme-preview' }}
            />,
        )

        expect(await screen.findByTestId('schema-fields')).toHaveTextContent('summary')
        expect(screen.getByTestId('schema-fields')).not.toHaveTextContent('related')
        expect(screen.getByTestId('schema-fields')).not.toHaveTextContent('reverse')
    })
})
