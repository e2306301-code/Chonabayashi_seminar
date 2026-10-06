interface ServiceWorkerContainerLike {
  register(url: string): Promise<unknown>
}

interface NavigatorLike {
  serviceWorker?: ServiceWorkerContainerLike
}

export async function registerServiceWorker(
  navigatorLike: NavigatorLike,
  baseUrl: string,
): Promise<void> {
  if (!navigatorLike.serviceWorker) return
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  await navigatorLike.serviceWorker.register(`${normalizedBase}sw.js`)
}
