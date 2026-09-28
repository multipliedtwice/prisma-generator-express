;(function () {
  'use strict'

  const root = document.querySelector('[data-guide-root]')
  const content = document.querySelector('[data-guide-content]')

  if (!root || !content) return

  const search = root.querySelector('[data-guide-search]')
  const searchClear = root.querySelector('[data-guide-search-clear]')
  const searchResults = root.querySelector('[data-guide-search-results]')
  const searchStatus = root.querySelector('[data-guide-search-status]')
  const toc = root.querySelector('[data-guide-toc]')
  const tocList = root.querySelector('[data-guide-toc-list]')
  const tocToggle = root.querySelector('[data-guide-toc-toggle]')
  const tocPanel = root.querySelector('[data-guide-toc-panel]')
  const progress = document.querySelector('[data-guide-progress]')
  const sectionCount = root.querySelector('[data-guide-section-count]')
  const readingTime = root.querySelector('[data-guide-reading-time]')
  const headings = Array.from(content.querySelectorAll('h2, h3'))

  const getHeadingText = function (heading) {
    return Array.from(heading.childNodes)
      .filter(function (node) {
        return !(
          node.nodeType === 1 &&
          (node.classList.contains('heading-anchor') ||
            node.classList.contains('guide-section-number'))
        )
      })
      .map(function (node) {
        return node.textContent
      })
      .join('')
      .trim()
  }

  const records = headings.map(function (heading) {
    const level = Number(heading.tagName.slice(1))
    const title = getHeadingText(heading)
    const fragments = []
    let sibling = heading.nextElementSibling

    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) {
        const siblingLevel = Number(sibling.tagName.slice(1))
        if (siblingLevel <= level) break
      }
      if (!sibling.matches('pre, .highlight, .code-block')) {
        fragments.push(sibling.textContent.trim())
      }
      sibling = sibling.nextElementSibling
    }

    return {
      element: heading,
      id: heading.id,
      level: level,
      title: title,
      searchTitle: title.toLowerCase(),
      text: fragments.join(' ').replace(/\s+/g, ' ').trim(),
    }
  })

  const topLevel = records.filter(function (record) {
    return record.level === 2
  })

  topLevel.forEach(function (record, index) {
    const number = document.createElement('span')
    number.className = 'guide-section-number'
    number.setAttribute('aria-hidden', 'true')
    number.textContent = String(index + 1).padStart(2, '0')
    record.element.insertBefore(number, record.element.firstChild)
  })

  if (sectionCount) {
    sectionCount.textContent =
      String(topLevel.length) +
      (topLevel.length === 1 ? ' section' : ' sections')
  }

  if (readingTime) {
    const prose = content.cloneNode(true)
    Array.from(
      prose.querySelectorAll('pre, code, .guide-prose__mastline'),
    ).forEach(function (element) {
      element.remove()
    })
    const words = prose.textContent.trim().split(/\s+/).filter(Boolean).length
    readingTime.textContent = String(Math.max(1, Math.ceil(words / 220)))
  }

  const tocLinks = new Map()

  if (tocList) {
    records.forEach(function (record) {
      const item = document.createElement('li')
      const link = document.createElement('a')
      item.className =
        'guide-toc__item guide-toc__item--h' + String(record.level)
      link.href = '#' + record.id
      link.textContent = record.title
      link.dataset.guideTocLink = record.id
      item.appendChild(link)
      tocList.appendChild(item)
      tocLinks.set(record.id, link)

      link.addEventListener('click', function () {
        if (
          window.matchMedia('(max-width: 72rem)').matches &&
          toc &&
          tocToggle
        ) {
          toc.classList.remove('is-open')
          tocToggle.setAttribute('aria-expanded', 'false')
          tocToggle.lastElementChild.textContent = '+'
        }
      })
    })
  }

  if (tocToggle && tocPanel && toc) {
    tocToggle.addEventListener('click', function () {
      const open = toc.classList.toggle('is-open')
      tocToggle.setAttribute('aria-expanded', String(open))
      tocToggle.lastElementChild.textContent = open ? '−' : '+'
    })
  }

  let scrollQueued = false
  let currentId = ''

  const updateScrollState = function () {
    scrollQueued = false
    const marker = window.scrollY + Math.min(190, window.innerHeight * 0.24)
    let active = records[0]

    records.forEach(function (record) {
      if (record.element.offsetTop <= marker) active = record
    })

    if (
      active &&
      active.level === 3 &&
      !window.matchMedia('(max-width: 72rem)').matches
    ) {
      const activeIndex = records.indexOf(active)
      active = records
        .slice(0, activeIndex + 1)
        .reverse()
        .find(function (record) {
          return record.level === 2
        })
    }

    if (active && active.id !== currentId) {
      currentId = active.id
      tocLinks.forEach(function (link, id) {
        if (id === currentId) link.setAttribute('aria-current', 'location')
        else link.removeAttribute('aria-current')
      })

      const current = tocLinks.get(currentId)
      if (current && !root.classList.contains('is-searching')) {
        current.scrollIntoView({ block: 'nearest' })
      }
    }

    if (progress) {
      const start = content.offsetTop
      const end = start + content.offsetHeight - window.innerHeight
      const ratio = end <= start ? 1 : (window.scrollY - start) / (end - start)
      progress.style.transform =
        'scaleX(' + String(Math.max(0, Math.min(1, ratio))) + ')'
    }
  }

  const queueScrollUpdate = function () {
    if (scrollQueued) return
    scrollQueued = true
    window.requestAnimationFrame(updateScrollState)
  }

  window.addEventListener('scroll', queueScrollUpdate, { passive: true })
  window.addEventListener('resize', queueScrollUpdate)
  updateScrollState()

  const normalize = function (value) {
    return value.toLowerCase().trim().replace(/\s+/g, ' ')
  }

  const excerptFor = function (record, query) {
    const source = record.text || record.title
    const lower = source.toLowerCase()
    const at = lower.indexOf(query)
    const start = Math.max(0, at < 0 ? 0 : at - 62)
    const end = Math.min(source.length, start + 158)
    return (
      (start > 0 ? '…' : '') +
      source.slice(start, end) +
      (end < source.length ? '…' : '')
    )
  }

  const appendHighlighted = function (target, value, query) {
    const lower = value.toLowerCase()
    const at = lower.indexOf(query)

    if (at < 0 || !query) {
      target.appendChild(document.createTextNode(value))
      return
    }

    target.appendChild(document.createTextNode(value.slice(0, at)))
    const mark = document.createElement('mark')
    mark.textContent = value.slice(at, at + query.length)
    target.appendChild(mark)
    target.appendChild(document.createTextNode(value.slice(at + query.length)))
  }

  let activeResult = -1

  const setActiveResult = function (index) {
    if (!searchResults) return
    const links = Array.from(searchResults.querySelectorAll('a'))
    if (!links.length) {
      activeResult = -1
      if (search) search.removeAttribute('aria-activedescendant')
      return
    }
    activeResult = index < 0 ? links.length - 1 : index % links.length
    links.forEach(function (link, linkIndex) {
      if (linkIndex === activeResult) {
        link.setAttribute('aria-selected', 'true')
        if (search) search.setAttribute('aria-activedescendant', link.id)
        link.scrollIntoView({ block: 'nearest' })
      } else {
        link.removeAttribute('aria-selected')
      }
    })
  }

  const clearSearch = function (focus) {
    if (!search || !searchResults || !searchClear || !searchStatus) return
    search.value = ''
    searchResults.replaceChildren()
    searchResults.hidden = true
    searchClear.hidden = true
    search.setAttribute('aria-expanded', 'false')
    search.removeAttribute('aria-activedescendant')
    searchStatus.textContent = 'Search every section'
    root.classList.remove('is-searching')
    activeResult = -1
    if (focus) search.focus()
  }

  const renderSearch = function () {
    if (!search || !searchResults || !searchClear || !searchStatus) return
    const query = normalize(search.value)
    searchResults.replaceChildren()
    activeResult = -1
    search.removeAttribute('aria-activedescendant')
    searchClear.hidden = query.length === 0

    if (!query) {
      searchResults.hidden = true
      search.setAttribute('aria-expanded', 'false')
      searchStatus.textContent = 'Search every section'
      root.classList.remove('is-searching')
      return
    }

    root.classList.add('is-searching')
    const rankedMatches = records
      .map(function (record) {
        const titleAt = record.searchTitle.indexOf(query)
        const bodyAt = record.text.toLowerCase().indexOf(query)
        const score =
          record.searchTitle === query
            ? 0
            : record.searchTitle.startsWith(query)
              ? 1
              : titleAt >= 0
                ? 2
                : bodyAt >= 0
                  ? 3
                  : 99
        return { record: record, score: score }
      })
      .filter(function (match) {
        return match.score < 99
      })
      .sort(function (a, b) {
        return a.score - b.score
      })
    const matches = rankedMatches.slice(0, 8)

    searchStatus.textContent = rankedMatches.length
      ? String(rankedMatches.length) +
        (rankedMatches.length === 1 ? ' match' : ' matches')
      : 'No matching sections'

    matches.forEach(function (match, index) {
      const item = document.createElement('li')
      const link = document.createElement('a')
      const title = document.createElement('strong')
      const excerpt = document.createElement('span')
      link.href = '#' + match.record.id
      link.id = 'guide-search-option-' + String(index + 1)
      link.setAttribute('role', 'option')
      appendHighlighted(title, match.record.title, query)
      appendHighlighted(excerpt, excerptFor(match.record, query), query)
      link.appendChild(title)
      link.appendChild(excerpt)
      item.appendChild(link)
      searchResults.appendChild(item)

      link.addEventListener('click', function () {
        clearSearch(false)
      })
    })

    searchResults.hidden = false
    search.setAttribute('aria-expanded', 'true')
  }

  if (search) {
    search.addEventListener('input', renderSearch)
    search.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveResult(activeResult + 1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveResult(activeResult - 1)
      } else if (event.key === 'Enter' && activeResult >= 0 && searchResults) {
        event.preventDefault()
        const links = searchResults.querySelectorAll('a')
        links[activeResult].click()
      } else if (event.key === 'Escape') {
        clearSearch(false)
        search.blur()
      }
    })
  }

  if (searchClear) {
    searchClear.addEventListener('click', function () {
      clearSearch(true)
    })
  }

  document.addEventListener('keydown', function (event) {
    const target = event.target
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable

    if (event.key === '/' && !typing && search) {
      event.preventDefault()
      search.focus()
    }
  })
})()
