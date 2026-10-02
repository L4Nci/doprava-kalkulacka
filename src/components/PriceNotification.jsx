import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const notificationSelection = `
  *,
  carriers(name),
  services(name)
`

export function PriceNotification() {
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
    fetchNotifications().catch(() => setError('Nepodařilo se načíst historii změn cen.'))

    const subscription = supabase
      .channel('price_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'price_change_notifications' },
        () => fetchNotifications().catch(() => setError('Nepodařilo se obnovit historii změn cen.'))
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [fetchNotifications])

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
    <div className="fixed top-4 right-4 z-50">
      <button
        aria-label="Historie změn cen"
        onClick={toggleHistory}
        className="relative p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span aria-label={`${unreadCount} nepřečtených změn`} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700">
          <div className="p-3 border-b dark:border-gray-700">
            <h3 className="font-semibold dark:text-white">Historie změn cen</h3>
          </div>
          {error && <p role="alert" className="p-3 bg-red-50 text-red-800 text-sm">{error}</p>}
          {isMarkingRead && <p role="status" className="px-4 pt-3 text-sm text-gray-500">Potvrzuji přečtení…</p>}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-gray-500 dark:text-gray-400 text-center">Žádná historie změn</p>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-b dark:border-gray-700 ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  <div className="space-y-1">
                    <p className="font-medium dark:text-white">{notification.carriers?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{notification.services?.name}</p>
                    <div className="flex gap-2 items-center">
                      <span className="line-through text-red-500 text-sm">{notification.old_price} Kč</span>
                      <span className="text-green-500 font-bold">{notification.new_price} Kč</span>
                    </div>
                    <p className="text-xs text-gray-500">{new Date(notification.created_at).toLocaleString('cs-CZ')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
