import { useEffect } from 'react'

type SeoOptions = {
  title: string
  description: string
  image?: string
  noindex?: boolean
}

// Reads/writes a <meta> tag identified by its own name/property attribute --
// that attribute is already the stable identifier the DOM (and search
// engines) key off of, so querying by it means repeat calls (route changes)
// update the existing tag in place instead of appending duplicates.
function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.querySelector(`meta[${attr}="${key}"]`)?.remove()
}

// Per-page document.title + meta tags for this SPA (index.html only ships one
// static set for the whole app, see index.html). Plain DOM manipulation --
// no react-helmet -- since there's nothing here a few lines of
// querySelector/createElement don't already cover.
//
// image/noindex are removed (not just left stale) when omitted, so
// navigating from a page that set them to one that doesn't leaves no
// leftover og:image or robots tag behind.
export function useSeo({ title, description, image, noindex }: SeoOptions) {
  useEffect(() => {
    document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)

    if (image) {
      setMeta('property', 'og:image', image)
    } else {
      removeMeta('property', 'og:image')
    }

    if (noindex) {
      setMeta('name', 'robots', 'noindex,nofollow')
    } else {
      removeMeta('name', 'robots')
    }
  }, [title, description, image, noindex])
}
