import { useState } from 'react'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { Link } from 'react-router-dom'
import {
    MoreHorizontal,
    ArrowLeft,
    Tag,
    Users,
    Image,
    Clock,
    MoveRight,
    Copy,
    Link as LinkIcon,
    PanelsTopLeft,
    Archive,
    Plus,
    Pencil,
} from 'lucide-react'
import { kanbanApi } from '../../api/kanban'

import { coverColors } from './cardPresentation'
const localDate = (value) => {
    const date = new Date(value)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
}

export function ActionsMenu({ label, children, card = false, onOpen }) {
    return (
        <Popover className={`kb-actions ${card ? 'kb-card-actions' : ''}`}>
            {({ close }) => (
                <>
                    <PopoverButton
                        onClick={onOpen}
                        className="kb-action-trigger"
                        aria-label={label}
                    >
                        <MoreHorizontal size={16} />
                    </PopoverButton>
                    <PopoverPanel
                        portal
                        anchor="bottom end"
                        focus
                        className="kb-action-popup"
                        aria-label={label}
                    >
                        {children(close)}
                    </PopoverPanel>
                </>
            )}
        </Popover>
    )
}

function Action({ icon: Icon, children, ...props }) {
    return (
        <button type="button" {...props}>
            {Icon && <Icon size={15} aria-hidden="true" />}
            {children}
        </button>
    )
}

export function CardActions({
    inDetail = false,
    card,
    columnCards,
    position,
    workspace,
    busy,
    run,
    move,
}) {
    const [panel, setPanel] = useState('')
    const [draft, setDraft] = useState({})
    const [labelName, setLabelName] = useState('')
    const destinations = workspace.columns.filter(
        (column) =>
            !column.archived &&
            !workspace.boards.find((board) => board.id === column.board)
                ?.archived,
    )
    const contentId = card.mirrorOf || card.id
    const show = (name) => {
        setDraft({
            assignees: card.assignees || [],
            labels: card.labels || [],
            deadline: card.deadline ? localDate(card.deadline) : '',
            coverColor: card.coverColor || '',
            column: card.column,
        })
        setPanel(name)
    }
    return (
        <ActionsMenu
            label={`Kortåtgärder för ${card.shortId}`}
            card={!inDetail}
            onOpen={() => setPanel('')}
        >
            {(close) => (
                <>
                    {panel ? (
                        <>
                            <Action
                                icon={ArrowLeft}
                                onClick={() => setPanel('')}
                            >
                                Kortåtgärder
                            </Action>
                            <form
                                className="kb-quick-form"
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    run(async () => {
                                        if (
                                            panel === 'copy' ||
                                            panel === 'mirror'
                                        ) {
                                            await kanbanApi.post(
                                                `cards/${card.id}/duplicate/`,
                                                {
                                                    revision: card.revision,
                                                    column: draft.column,
                                                    mirror: panel === 'mirror',
                                                },
                                            )
                                        } else {
                                            const values =
                                                panel === 'members'
                                                    ? {
                                                          assignees:
                                                              draft.assignees,
                                                      }
                                                    : panel === 'labels'
                                                      ? { labels: draft.labels }
                                                      : panel === 'cover'
                                                        ? {
                                                              coverColor:
                                                                  draft.coverColor,
                                                          }
                                                        : {
                                                              deadline:
                                                                  draft.deadline
                                                                      ? new Date(
                                                                            draft.deadline,
                                                                        ).toISOString()
                                                                      : null,
                                                          }
                                            await kanbanApi.patch(
                                                `cards/${contentId}/`,
                                                {
                                                    revision:
                                                        card.contentRevision ||
                                                        card.revision,
                                                    ...values,
                                                },
                                            )
                                        }
                                        setPanel('')
                                        close()
                                    })
                                }}
                            >
                                <h3>
                                    {
                                        {
                                            members: 'Ändra medlemmar',
                                            labels: 'Ändra etiketter',
                                            cover: 'Byt omslag',
                                            dates: 'Redigera datum',
                                            copy: 'Kopiera kort',
                                            mirror: 'Spegla kort',
                                        }[panel]
                                    }
                                </h3>
                                {(panel === 'members' ||
                                    panel === 'labels') && (
                                    <fieldset>
                                        <legend className="sr-only">
                                            {panel === 'members'
                                                ? 'Medlemmar'
                                                : 'Etiketter'}
                                        </legend>
                                        {(panel === 'members'
                                            ? workspace.members
                                            : workspace.labels
                                        ).map((item) => {
                                            const field =
                                                panel === 'members'
                                                    ? 'assignees'
                                                    : 'labels'
                                            return (
                                                <label
                                                    className="kb-check-option"
                                                    key={item.id}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={draft[
                                                            field
                                                        ].includes(item.id)}
                                                        onChange={(e) =>
                                                            setDraft({
                                                                ...draft,
                                                                [field]: e
                                                                    .target
                                                                    .checked
                                                                    ? [
                                                                          ...draft[
                                                                              field
                                                                          ],
                                                                          item.id,
                                                                      ]
                                                                    : draft[
                                                                          field
                                                                      ].filter(
                                                                          (
                                                                              id,
                                                                          ) =>
                                                                              id !==
                                                                              item.id,
                                                                      ),
                                                            })
                                                        }
                                                    />
                                                    {item.name}
                                                </label>
                                            )
                                        })}
                                        {panel === 'members' &&
                                            !workspace.members.length && (
                                                <p>
                                                    Inga medlemmar i arbetsytan.
                                                </p>
                                            )}
                                        {panel === 'labels' && (
                                            <div className="kb-new-label">
                                                <label className="kb-floating-field">
                                                    <span>Ny etikett</span>
                                                    <input
                                                        placeholder=" "
                                                        aria-label="Ny etikett"
                                                        value={labelName}
                                                        onChange={(e) =>
                                                            setLabelName(
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </label>
                                                <button
                                                    type="button"
                                                    disabled={
                                                        busy ||
                                                        !labelName.trim()
                                                    }
                                                    onClick={() =>
                                                        run(async () => {
                                                            const label =
                                                                await kanbanApi.post(
                                                                    'workspace/labels/',
                                                                    {
                                                                        name: labelName.trim(),
                                                                    },
                                                                )
                                                            setDraft({
                                                                ...draft,
                                                                labels: [
                                                                    ...draft.labels,
                                                                    label.id,
                                                                ],
                                                            })
                                                            setLabelName('')
                                                        })
                                                    }
                                                >
                                                    Skapa etikett
                                                </button>
                                            </div>
                                        )}
                                    </fieldset>
                                )}
                                {panel === 'dates' && (
                                    <label className="kb-floating-field">
                                        <span>Deadline</span>
                                        <input
                                            aria-label="Deadline"
                                            type="datetime-local"
                                            value={draft.deadline}
                                            onChange={(e) =>
                                                setDraft({
                                                    ...draft,
                                                    deadline: e.target.value,
                                                })
                                            }
                                        />
                                    </label>
                                )}
                                {panel === 'cover' && (
                                    <fieldset>
                                        <legend>Omslagsfärg</legend>
                                        <div className="kb-cover-options">
                                            {Object.entries({
                                                '': 'transparent',
                                                ...coverColors,
                                            }).map(([name, color]) => (
                                                <label
                                                    key={name}
                                                    style={{
                                                        background: color,
                                                    }}
                                                    title={
                                                        name || 'Inget omslag'
                                                    }
                                                >
                                                    <input
                                                        type="radio"
                                                        name="cover"
                                                        aria-label={
                                                            name ||
                                                            'Inget omslag'
                                                        }
                                                        checked={
                                                            draft.coverColor ===
                                                            name
                                                        }
                                                        onChange={() =>
                                                            setDraft({
                                                                ...draft,
                                                                coverColor:
                                                                    name,
                                                            })
                                                        }
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                )}
                                {(panel === 'copy' || panel === 'mirror') && (
                                    <>
                                        <p>
                                            {panel === 'mirror'
                                                ? 'Delar innehåll, diskussion och filer med originalet.'
                                                : 'Kopierar innehåll och checklista. Diskussion och filer stannar på originalet.'}
                                        </p>
                                        <Destination
                                            label="Till lista"
                                            value={draft.column}
                                            onChange={(column) =>
                                                setDraft({ ...draft, column })
                                            }
                                            columns={destinations}
                                            workspace={workspace}
                                        />
                                    </>
                                )}
                                <button
                                    className="kb-save-action"
                                    disabled={busy}
                                >
                                    Spara
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            {!inDetail && <>
                            <Link
                                className="kb-menu-link"
                                to={`/kanban/cards/${contentId}`}
                                onClick={() => close()}
                            >
                                <PanelsTopLeft size={15} />
                                Öppna kort
                            </Link>
                            </>}
                            <Action icon={Tag} onClick={() => show('labels')}>
                                Ändra etiketter
                            </Action>
                            <Action
                                icon={Users}
                                onClick={() => show('members')}
                            >
                                Ändra medlemmar
                            </Action>
                            <Action icon={Image} onClick={() => show('cover')}>
                                Byt omslag
                            </Action>
                            <Action icon={Clock} onClick={() => show('dates')}>
                                Redigera datum
                            </Action>
                            <div className="kb-menu-move">
                                <span>
                                    <MoveRight size={15} />
                                    Flytta
                                </span>
                                <div className="kb-move-arrows">
                                    <button
                                        disabled={position === 0 || busy}
                                        onClick={() =>
                                            move(
                                                card,
                                                card.column,
                                                columnCards[position - 1]
                                                    .position,
                                            )
                                        }
                                        aria-label={`Flytta ${card.shortId} upp`}
                                    >
                                        ↑
                                    </button>
                                    <button
                                        disabled={
                                            busy ||
                                            position === columnCards.length - 1
                                        }
                                        onClick={() =>
                                            move(
                                                card,
                                                card.column,
                                                columnCards[position + 1]
                                                    .position,
                                            )
                                        }
                                        aria-label={`Flytta ${card.shortId} ned`}
                                    >
                                        ↓
                                    </button>
                                </div>
                                <Destination
                                    label={`Flytta ${card.shortId} till`}
                                    value={card.column}
                                    disabled={busy}
                                    onChange={(column) => {
                                        move(card, column)
                                        close()
                                    }}
                                    columns={destinations}
                                    workspace={workspace}
                                />
                            </div>
                            <Action icon={Copy} onClick={() => show('copy')}>
                                Kopiera kort
                            </Action>
                            <Action
                                icon={LinkIcon}
                                onClick={() =>
                                    run(async () => {
                                        await navigator.clipboard.writeText(
                                            `${window.location.origin}/kanban/cards/${contentId}`,
                                        )
                                        close()
                                    })
                                }
                            >
                                Kopiera länk
                            </Action>
                            <Action
                                icon={PanelsTopLeft}
                                onClick={() => show('mirror')}
                            >
                                Spegla
                            </Action>
                            <Action
                                icon={Archive}
                                disabled={busy}
                                onClick={() =>
                                    run(async () => {
                                        await kanbanApi.patch(
                                            `cards/${card.id}/`,
                                            {
                                                revision: card.revision,
                                                archived: !card.archived,
                                            },
                                        )
                                        close()
                                    })
                                }
                            >
                                {card.archived ? 'Återställ' : 'Arkivera'}
                            </Action>
                        </>
                    )}
                </>
            )}
        </ActionsMenu>
    )
}

function Destination({ label, columns, workspace, onChange, ...props }) {
    return (
        <label className="kb-floating-field">
            <span>{label}</span>
            <select
                aria-label={label}
                onChange={(e) => onChange(e.target.value)}
                {...props}
            >
                {columns.map((column) => (
                    <option key={column.id} value={column.id}>
                        {
                            workspace.boards.find(
                                (board) => board.id === column.board,
                            )?.title
                        }{' '}
                        / {column.title}
                    </option>
                ))}
            </select>
        </label>
    )
}

export function ColumnActions({
    column,
    index,
    columns,
    busy,
    run,
    reorder,
    rename,
    addCard,
    board,
}) {
    return (
        <ActionsMenu label={`Liståtgärder för ${column.title}`}>
            {(close) => (
                <>
                    <Action
                        icon={Plus}
                        disabled={column.archived || board.archived}
                        onClick={() => {
                            addCard(column.id)
                            close()
                        }}
                    >
                        Lägg till kort
                    </Action>
                    <Action
                        icon={Pencil}
                        onClick={() => {
                            rename({ type: 'columns', ...column })
                            close()
                        }}
                    >
                        Byt namn
                    </Action>
                    <Action
                        icon={Copy}
                        disabled={busy || board.archived}
                        onClick={() =>
                            run(async () => {
                                await kanbanApi.post(`columns/${column.id}/duplicate/`, { revision: column.revision })
                                close()
                            })
                        }
                    >
                        Kopiera lista
                    </Action>
                    <Action
                        disabled={index === 0 || busy}
                        aria-label={`Flytta ${column.title} vänster`}
                        onClick={() => {
                            reorder(column.id, index - 1)
                            close()
                        }}
                    >
                        ← Flytta vänster
                    </Action>
                    <Action
                        disabled={index === columns.length - 1 || busy}
                        aria-label={`Flytta ${column.title} höger`}
                        onClick={() => {
                            reorder(column.id, index + 1)
                            close()
                        }}
                    >
                        → Flytta höger
                    </Action>
                    <Action
                        icon={Archive}
                        disabled={busy || !!column.role}
                        title={column.role ? 'Obligatorisk lista' : undefined}
                        onClick={() =>
                            run(async () => {
                                await kanbanApi.patch(`columns/${column.id}/`, {
                                    revision: column.revision,
                                    archived: !column.archived,
                                })
                                close()
                            })
                        }
                    >
                        {column.archived ? 'Återställ lista' : 'Arkivera lista'}
                    </Action>
                </>
            )}
        </ActionsMenu>
    )
}
