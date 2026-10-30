import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const notificationSelection = `
  *,
  carriers(name),
  services(name)
`

const eventTypes = {
  price_changed: {
    label: 'Změna ceny',
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    path: 'M7 7h10m0 0-3-3m3 3-3 3M17 17H7m0 0 3-3m-3 3 3 3'
  },
  carrier_added: {
    label: 'Nový dopravce',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    path: 'M12 5v14m-7-7h14'
  },
  carrier_deactivated: {
    label: 'Dopravce deaktivován',
    color: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    path: 'M9 5v14M15 5v14'
  },
  carrier_activated: {
    label: 'Dopravce aktivován',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    path: 'm9 5 10 7-10 7V5Z'
  }
}

const priceFormat = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 })

function EventIcon({ path, className = 'h-4 w-4' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path} />
    </svg>
  )
}

export function PriceNotification() {
  const panelId = useId()
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const closeRef = useRef(null)
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState(null)
  const [isMarkingRead, setIsMarkingRead] = useState(false)

  const fetchNotifications = useCallback(async () => {
    const [historyResult, countResult] = await Promise.all([
      supabase
        .from('price_change_notifications')
        .select(notificationSelection)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('price_change_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('read', false)
    ])

    if (historyResult.error) throw historyResult.error
    if (countResult.error) throw countResult.error
    const history = historyResult.data || []
    setNotifications(history)
    setUnreadCount(countResult.count || 0)
    return history
  }, [])

  useEffect(() => {
    fetchNotifications().catch(() => setError('Nepodařilo se načíst historii změn.'))

    const subscription = supabase
      .channel('price_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'price_change_notifications' },
        () => fetchNotifications().catch(() => setError('Nepodařilo se obnovit historii změn.'))
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [fetchNotifications])

  useEffect(() => {
    if (!isOpen) return
    closeRef.current?.focus()
    const handlePointerDown = event => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const openHistory = async () => {
    setIsOpen(true)
    setError(null)
    setIsMarkingRead(true)
    try {
      const displayed = await fetchNotifications()
      const unreadIds = displayed.filter(notification => !notification.read).map(notification => notification.id)
      if (unreadIds.length > 0) {
        const { error: rpcError } = await supabase.rpc('mark_price_change_notifications_read', {
          notification_ids: unreadIds
        })
        if (rpcError) throw rpcError
        await fetchNotifications()
      }
    } catch {
      setError('Nepodařilo se potvrdit přečtení historie. Zkuste panel otevřít znovu.')
    } finally {
      setIsMarkingRead(false)
    }
  }

  const toggleHistory = () => {
    if (isOpen) setIsOpen(false)
    else openHistory()
  }

  return (
    <div ref={containerRef} className="fixed top-4 right-4 z-50">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Historie změn"
        title="Historie změn"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={toggleHistory}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${isOpen ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span aria-label={`${unreadCount} nepřečtených změn`} className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-gray-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Historie změn"
          aria-busy={isMarkingRead}
          className="absolute right-0 mt-3 flex max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-700">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Historie změn</h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Ceny a dostupnost dopravců</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label="Zavřít historii změn"
              onClick={() => { setIsOpen(false); triggerRef.current?.focus() }}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <EventIcon path="m6 6 12 12M6 18 18 6" />
            </button>
          </div>
          {error && <p role="alert" className="shrink-0 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
          {isMarkingRead && <p role="status" className="shrink-0 px-4 py-2 text-xs text-gray-500 dark:text-gray-400">Načítám změny…</p>}
          <div className="min-h-0 max-h-[28rem] overflow-y-auto overscroll-contain">
            {notifications.length === 0 && !isMarkingRead && !error ? (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700">
                  <EventIcon path="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Zatím žádné změny</p>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Tady najdete změny cen i dostupnosti dopravců.</p>
              </div>
            ) : (
              notifications.map(notification => {
                const eventType = notification.event_type || 'price_changed'
                const event = eventTypes[eventType] || eventTypes.price_changed
                return (
                  <div key={notification.id} className={`flex gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0 dark:border-gray-700 ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${event.color}`}>
                      <EventIcon path={event.path} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${event.color}`}>{event.label}</span>
                      <p className="mt-1.5 break-words text-sm font-semibold text-gray-900 dark:text-white">{notification.carrier_name || notification.carriers?.name || 'Dopravce'}</p>
                      {eventType === 'price_changed' && (
                        <>
                          <p className="mt-0.5 break-words text-xs text-gray-500 dark:text-gray-400">{notification.services?.name}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className="text-gray-400 line-through dark:text-gray-500">{priceFormat.format(notification.old_price)} Kč</span>
                            <EventIcon path="M5 12h14m-5-5 5 5-5 5" className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{priceFormat.format(notification.new_price)} Kč</span>
                          </div>
                        </>
                      )}
                      <time dateTime={notification.created_at} className="mt-2 block text-[11px] text-gray-500 dark:text-gray-400">
                        {new Date(notification.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {notifications.length > 0 && <p className="shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-center text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">Posledních 10 změn · od nejnovějších</p>}
        </div>
      )}
    </div>
  )
}
