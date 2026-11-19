import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { supportError, supportRequest } from '../../api/support'
import { getCmsCopyLanguage } from '../../utils/cmsCopy'
import { useSupportIdentity, useSupportTenant } from './useSupportContext'
import PrivateVideoThumbnail from './PrivateVideoThumbnail'

type Instruction = {
    id: string
    title: string
    description: string
    videoId?: string
    publishedAt: string
    language: string
    archived: boolean
    withdrawn: boolean
}
type LibraryResult = { results: Instruction[]; next?: string; previous?: string }

export default function InstructionLibrary({ link }: { link: (path: string) => string }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const searchId = useId()
    const searchInput = useRef<HTMLInputElement>(null)
    const sv = getCmsCopyLanguage().startsWith('sv')
    const [searchText, setSearchText] = useState('')
    const [filters, setFilters] = useState({ search: '', archive: false, page: 1 })
    useEffect(() => {
        if (searchText.trim() === filters.search) return
        const timer = window.setTimeout(() => {
            setFilters((previous) => ({ ...previous, search: searchText.trim(), page: 1 }))
        }, 250)
        return () => window.clearTimeout(timer)
    }, [searchText, filters.search])
    const { search, archive, page } = filters
    const query = useQuery<LibraryResult>({
        queryKey: ['support', tenant, identity, 'library', archive, page, search],
        queryFn: () => supportRequest(tenant,
            `instructions/?page=${page}&archived=${archive}&search=${encodeURIComponent(search)}`),
    })
    const setArchive = (value: boolean) => setFilters((previous) => ({ ...previous, archive: value, page: 1 }))
    const clearSearch = () => {
        setSearchText('')
        setFilters((previous) => ({ ...previous, search: '', page: 1 }))
        searchInput.current?.focus()
    }
    const searchLabel = sv ? 'Sök instruktionsfilmer' : 'Search instruction videos'
    return (
        <section className="instruction-library">
            <h2>{sv ? 'Instruktionsfilmer' : 'Instruction videos'}</h2>
            <p>{sv ? 'Senaste publiceringen först.' : 'Newest publications first.'}</p>
            <div role="search" aria-label={searchLabel} className="instruction-search-wrap">
                <div className={`instruction-search ${searchText || archive ? 'is-filled' : ''}`}>
                    <Search size={16} aria-hidden="true" />
                    <div className="instruction-search-input">
                        <input ref={searchInput} id={searchId} type="search" value={searchText}
                            onChange={(event) => setSearchText(event.target.value)} />
                        <label htmlFor={searchId}>{searchLabel}</label>
                    </div>
                    {searchText && <button type="button" className="instruction-search-icon" onClick={clearSearch}
                        aria-label={sv ? 'Rensa sökning' : 'Clear search'}><X size={16} /></button>}
                    {archive && <button type="button" className="instruction-filter-pill" onClick={() => {
                        setArchive(false)
                        searchInput.current?.focus()
                    }}
                        aria-label={sv ? 'Ta bort filtret arkiverade filmer' : 'Remove archived videos filter'}>
                        {sv ? 'Även arkiverade' : 'Including archived'}<X size={12} aria-hidden="true" />
                    </button>}
                    <Popover className="instruction-filter">
                        <PopoverButton className="instruction-search-icon" aria-label={sv ? 'Lägg till filter' : 'Add filter'}>
                            <SlidersHorizontal size={16} aria-hidden="true" />
                        </PopoverButton>
                        <PopoverPanel className="instruction-filter-menu">
                            <label><input type="checkbox" checked={archive} onChange={(event) => setArchive(event.target.checked)} />
                                {sv ? 'Visa även arkiverade filmer' : 'Also show archived videos'}
                            </label>
                        </PopoverPanel>
                    </Popover>
                </div>
            </div>
            {query.error && <p className="support-error" role="alert">{supportError(query.error)}</p>}
            {query.isPending && <p role="status">{sv ? 'Hämtar instruktioner…' : 'Loading instructions…'}</p>}
            <div className="instruction-results" aria-busy={query.isFetching}>
                {query.data?.results.map((instruction) => (
                    <article key={instruction.id}>
                        <Link className="instruction-row" to={link(`instructions/${instruction.id}`)}
                            aria-labelledby={`instruction-title-${instruction.id}`}>
                            <PrivateVideoThumbnail key={`${tenant}:${identity}:${instruction.videoId}`} id={instruction.withdrawn ? undefined : instruction.videoId} />
                            <div className="instruction-copy">
                                <h3 id={`instruction-title-${instruction.id}`}>{instruction.title}</h3>
                                <p className="instruction-description">{instruction.description}</p>
                                <p className="instruction-meta">
                                    <time dateTime={instruction.publishedAt}>{new Date(instruction.publishedAt).toLocaleDateString(getCmsCopyLanguage())}</time>
                                    {' · '}{instruction.language === 'en' ? 'English' : 'Svenska'}
                                    {instruction.archived && (sv ? ' · Arkiverad' : ' · Archived')}
                                    {instruction.withdrawn && (sv ? ' · Avpublicerad' : ' · Unpublished')}
                                </p>
                            </div>
                        </Link>
                    </article>
                ))}
            </div>
            {query.data?.results.length === 0 && (
                <p role="status">{search
                    ? (sv ? 'Inga filmer matchar sökningen. Prova ett annat sökord.' : 'No videos match your search. Try another search term.')
                    : (sv ? 'Inga publicerade instruktioner ännu.' : 'No instructions published yet.')}</p>
            )}
            {(query.data?.previous || query.data?.next) && <div className="support-actions">
                <button disabled={!query.data.previous} onClick={() => setFilters((previous) => ({ ...previous, page: page - 1 }))}>{sv ? 'Föregående' : 'Previous'}</button>
                <span>{sv ? 'Sida' : 'Page'} {page}</span>
                <button disabled={!query.data.next} onClick={() => setFilters((previous) => ({ ...previous, page: page + 1 }))}>{sv ? 'Nästa' : 'Next'}</button>
            </div>}
        </section>
    )
}
