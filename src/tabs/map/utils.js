export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
    return entities[char] || char
  })
}

export function toGeoJSONPoints(items, getCoord, getProps) {
  return {
    type: "FeatureCollection",
    features: (items || [])
      .map((item) => {
        const [lat, lng] = getCoord(item) || []
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: getProps ? getProps(item) : {},
        }
      })
      .filter(Boolean),
  }
}

export function loadImage(map, id, src) {
  return new Promise((resolve) => {
    if (map.hasImage(id)) {
      resolve()
      return
    }
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        map.addImage(id, img, { sdf: false })
      } catch (err) {
        console.warn(`Ne morem dodati slike "${id}":`, err)
      }
      resolve()
    }
    img.onerror = () => resolve()
    img.src = src
  })
}

export function ensureIcons(map, iconSources) {
  return Promise.all(iconSources.map(({ id, image }) => loadImage(map, id, image)))
}
