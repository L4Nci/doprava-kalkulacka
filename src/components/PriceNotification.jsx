import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function PriceNotification() {
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Načtení posledních 10 notifikací
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('price_change_notifications')
        .select(`
          *,
          carriers(name),
          services(name)
        `)
        .order('created_at', { ascending: false })
        .eq('read', false)
        .limit(10)
      
      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.read)?.length || 0)
    }

    fetchNotifications()

    // Real-time subscription
    const subscription = supabase
      .channel('price_changes')
      .on('INSERT', { event: '*', schema: 'public', table: 'price_change_notifications' }, 
        payload => {
          setNotifications(prev => [payload.new, ...prev.slice(0, 9)])
          setUnreadCount(count => count + 1)
        }
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  const markAsRead = async (id) => {
    await supabase
      .from('price_change_notifications')
      .update({ read: true })
      .eq('id', id)
    
    setNotifications(prev => 
      prev.map(n => n.id === id ? {...n, read: true} : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <div className="p-2 border-b dark:border-gray-700">
            <h3 className="font-semibold dark:text-white">Historie změn cen</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-gray-500 dark:text-gray-400 text-center">
                Žádné nové změny
              </p>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`p-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                    !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-center gap-2">
                    <img 
                      src={notification.carriers?.logo_url} 
                      alt={notification.carriers?.name}
                      className="h-6 w-auto" 
                    />
                    <div>
                      <p className="font-medium dark:text-white">
                        {notification.carriers?.name} - {notification.services?.name}
                      </p>
                      <div className="flex gap-2 text-sm">
                        <span className="line-through text-red-500">
                          {notification.old_price} Kč
                        </span>
                        <span className="text-green-500 font-bold">
                          {notification.new_price} Kč
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(notification.created_at)}
                      </p>
                    </div>
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
