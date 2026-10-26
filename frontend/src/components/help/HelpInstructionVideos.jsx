import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supportRequest, supportError } from '../../api/support'
import { useSupportContext, useSupportIdentity, useSupportTenant } from '../support/useSupportContext'
import PrivateVideoPlayer from '../support/PrivateVideoPlayer'

export default function HelpInstructionVideos({ guideId, language, children }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const context = useSupportContext()
    const query = useInfiniteQuery({
        queryKey: ['support', tenant, identity, 'help-instructions', guideId, language],
        initialPageParam: 1,
        queryFn: ({ pageParam }) => supportRequest(tenant, `instructions/?help_guide_id=${encodeURIComponent(guideId)}&language=${encodeURIComponent(language)}&page=${pageParam}`),
        getNextPageParam: (lastPage, _pages, lastPageParam) => lastPage.next ? lastPageParam + 1 : undefined,
        enabled: !!tenant,
        retry: false,
    })
    const instructions = query.data?.pages.flatMap((page) => page.results) || []
    const tenantQuery = encodeURIComponent(tenant || '')
    return (
        <section aria-label="Instruktionsfilmer för hjälpartikeln">
            {query.isPending && tenant && <p role="status" className="mb-3 text-sm text-gray-500">Hämtar arbetsytans instruktionsfilmer…</p>}
            {query.error && <p role="alert" className="mb-3 text-sm text-red-700">Kunde inte hämta arbetsytans filmer. {supportError(query.error)}</p>}
            {instructions.length ? (
                <div className="space-y-6">
                    {instructions.map((instruction) => (
                        <section key={instruction.id} aria-label={instruction.title}>
                            <h2 className="text-lg font-semibold text-gray-900">{instruction.title}</h2>
                            <p className="mt-1 text-sm text-gray-600">{instruction.description}</p>
                            <PrivateVideoPlayer id={instruction.videoId} />
                            {instruction.transcript && (
                                <details className="my-3 text-sm text-gray-700">
                                    <summary className="cursor-pointer font-medium">Text till filmen</summary>
                                    <p className="mt-2 whitespace-pre-wrap">{instruction.transcript}</p>
                                </details>
                            )}
                            <Link className="text-sm font-medium text-blue-600 hover:underline" to={`/inbox/instructions/${instruction.id}?tenant=${tenantQuery}`}>
                                Öppna filmen i Inbox
                            </Link>
                        </section>
                    ))}
                </div>
            ) : children}
            {query.hasNextPage && (
                <button
                    type="button"
                    disabled={query.isFetchingNextPage}
                    onClick={() => query.fetchNextPage()}
                    className="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    {query.isFetchingNextPage ? 'Hämtar fler filmer…' : 'Visa fler instruktionsfilmer'}
                </button>
            )}
            {context.data?.canPublish && (
                <Link
                    className="mt-4 inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    to={`/inbox/publish?tenant=${tenantQuery}&guide=${encodeURIComponent(guideId)}&lang=${encodeURIComponent(language)}`}
                >
                    Lägg till instruktionsfilm här
                </Link>
            )}
        </section>
    )
}
