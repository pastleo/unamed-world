(window as any).ENTRY_POINTS_MAPPING = typeof window !== 'undefined' ? JSON.parse(
  (document.head.querySelector('meta[name=entry-points-mapping]') as HTMLMetaElement)?.content || '{}'
) : {}
