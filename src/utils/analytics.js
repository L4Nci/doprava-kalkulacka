export const logError = (error, context) => {
  // Logování chyb
  console.error(`[${context}]`, error)
  // Zde můžeme přidat např. Sentry/LogRocket
}

export const trackEvent = (eventName, data) => {
  // Sledování událostí
  console.log(`[EVENT] ${eventName}`, data)
  // Zde můžeme přidat např. Google Analytics
}

export const trackMetric = (name, value) => {
  // Měření výkonu
  console.log(`[METRIC] ${name}:`, value)
  // Zde můžeme přidat např. Custom Metrics
}
