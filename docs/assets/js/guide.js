;(function () {
  'use strict'

  const root = document.querySelector('[data-guide-root]')
  const content = document.querySelector('[data-guide-content]')

  if (!root || !content) return

  const $ = function (selector, scope) {
    return (scope || document).querySelector(selector)
  }

  const $$ = function (selector, scope) {
    return Array.from((scope || document).querySelectorAll(selector))
  }

  const el = function (tag, attrs, children) {
    const node = document.createElement(tag)
    Object.entries(attrs || {}).forEach(function (entry) {
      const key = entry[0]
      const value = entry[1]
      if (value === null || value === undefined || value === false) return
      if (key === 'class') node.className = value
      else if (key === 'text') node.textContent = value
      else node.setAttribute(key, value === true ? '' : String(value))
    })
    ;(children || []).forEach(function (child) {
      if (child !== null && child !== undefined) node.append(child)
    })
    return node
  }

  const squash = function (value) {
    return value.replace(/\s+/g, ' ').trim()
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const drawerMode = window.matchMedia('(max-width: 64rem)')
  const header = $('.site-header')
  const mobilebar = $('.guide-mobilebar', root)

  const readParts = function () {
    const source = $('[data-guide-parts]')
    if (!source) return []
    try {
      const parsed = JSON.parse(source.textContent)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      return []
    }
  }

  const headingText = function (heading) {
    return squash(
      Array.from(heading.childNodes)
        .filter(function (node) {
          return !(
            node.nodeType === 1 &&
            node.matches('.heading-anchor, .guide-h2-meta')
          )
        })
        .map(function (node) {
          return node.textContent
        })
        .join(''),
    )
  }

  const isHeading = function (node) {
    return /^H[1-4]$/.test(node.tagName)
  }

  const isCode = function (node) {
    return node.matches('.code-block, pre, .highlight')
  }

  const sectionNodes = function (heading) {
    const nodes = []
    let node = heading.nextElementSibling
    while (node && !isHeading(node)) {
      nodes.push(node)
      node = node.nextElementSibling
    }
    return nodes
  }

  const codeText = function (node) {
    const pre = node.matches('pre') ? node : $('pre', node)
    return pre ? pre.textContent : node.textContent
  }

  const buildRecords = function (parts) {
    const starts = new Map(
      parts.map(function (part) {
        return [part.start, part.title]
      }),
    )
    let part = ''
    let h2 = null
    let h3 = null
    let number = 0

    return $$(':scope > h1, :scope > h2, :scope > h3, :scope > h4', content).map(
      function (heading, index) {
        const level = Number(heading.tagName.slice(1))
        const nodes = sectionNodes(heading)
        const title = headingText(heading)

        if (level === 2) {
          part = starts.get(heading.id) || part
          number += 1
        }

        const record = {
          element: heading,
          id: heading.id || 'guide-top',
          index: index,
          level: level,
          title: title,
          part: level === 1 ? '' : part,
          number: level === 2 ? number : 0,
          h2: level > 2 ? h2 : null,
          h3: level > 3 ? h3 : null,
          text: squash(
            nodes
              .filter(function (node) {
                return !isCode(node)
              })
              .map(function (node) {
                return node.textContent
              })
              .join(' '),
          ),
          code: squash(nodes.filter(isCode).map(codeText).join(' ')),
        }

        if (level === 1 && !heading.id) heading.id = record.id
        if (level === 2) {
          h2 = record
          h3 = null
        }
        if (level === 3) h3 = record

        const chain = [record.part, record.h2 && record.h2.title, record.h3 && record.h3.title].filter(Boolean)
        record.trail = chain
          .filter(function (value, position) {
            return (chain[position + 1] || title).indexOf(value) !== 0
          })
          .join(' › ')
        record.titleLower = title.toLowerCase()
        record.textLower = record.text.toLowerCase()
        record.codeLower = record.code.toLowerCase()
        record.trailLower = record.trail.toLowerCase()
        return record
      },
    )
  }

  const records = buildRecords(readParts())
  const overview = records.find(function (record) {
    return record.level === 1
  })
  const sections = records.filter(function (record) {
    return record.level === 2
  })
  const byId = new Map(
    records.map(function (record) {
      return [record.id, record]
    }),
  )
  const childrenOf = function (section) {
    return records.filter(function (record) {
      return record.level === 3 && record.h2 === section
    })
  }

  const pad = function (value) {
    return String(value).padStart(2, '0')
  }

  sections.forEach(function (section) {
    section.element.prepend(
      el('span', { class: 'guide-h2-meta', 'aria-hidden': 'true' }, [
        el('span', { text: pad(section.number) }),
        el('span', { text: section.part }),
      ]),
    )
  })

  const toastNode = $('[data-guide-toast]')
  let toastTimer = 0

  const toast = function (message) {
    if (!toastNode) return
    toastNode.textContent = message
    toastNode.classList.add('is-visible')
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(function () {
      toastNode.classList.remove('is-visible')
    }, 1800)
  }

  const flash = function (element) {
    element.classList.remove('is-target')
    void element.offsetWidth
    element.classList.add('is-target')
  }

  const goTo = function (record, push) {
    if (!record) return
    const target = record.element
    const hash = '#' + record.id
    if (push && window.location.hash !== hash) window.history.pushState(null, '', hash)
    target.scrollIntoView({
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
      block: 'start',
    })
    target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    flash(target)
  }

  const keepInView = function (container, item) {
    if (!container || !item) return
    const box = container.getBoundingClientRect()
    const rect = item.getBoundingClientRect()
    const gap = 12
    if (rect.top < box.top + gap) container.scrollTop -= box.top + gap - rect.top
    else if (rect.bottom > box.bottom - gap)
      container.scrollTop += rect.bottom - (box.bottom - gap)
  }

  const navRoot = $('[data-guide-nav]', root)
  const navList = $('[data-guide-nav-list]', root)
  const navOpen = $('[data-guide-nav-open]', root)
  const navClose = $('[data-guide-nav-close]', root)
  const navScrim = $('[data-guide-nav-scrim]', root)
  const navLinks = new Map()
  const backdropRegions = [header, mobilebar, content, $('.site-footer')].filter(Boolean)

  const navLink = function (record, extraClass) {
    const link = el(
      'a',
      { class: 'guide-nav__link' + (extraClass || ''), href: '#' + record.id },
      [
        record.number ? el('span', { class: 'guide-nav__num', 'aria-hidden': 'true', text: pad(record.number) }) : null,
        el('span', { text: record.level === 1 ? 'Overview' : record.title }),
      ],
    )
    navLinks.set(record.id, link)
    return link
  }

  const groupByPart = function (items) {
    return items.reduce(function (groups, item) {
      const last = groups[groups.length - 1]
      if (last && last.title === item.part) last.items.push(item)
      else groups.push({ title: item.part, items: [item] })
      return groups
    }, [])
  }

  if (navList) {
    const lists = groupByPart(sections).map(function (group) {
      return el('li', { class: 'guide-nav__part' }, [
        group.title ? el('p', { class: 'guide-nav__part-title', text: group.title }) : null,
        el(
          'ol',
          { class: 'guide-nav__list' },
          group.items.map(function (section) {
            const subs = childrenOf(section)
            return el('li', { class: 'guide-nav__item', 'data-id': section.id }, [
              navLink(section),
              subs.length
                ? el(
                    'ol',
                    { class: 'guide-nav__sub' },
                    subs.map(function (sub) {
                      return el('li', null, [navLink(sub, ' guide-nav__link--sub')])
                    }),
                  )
                : null,
            ])
          }),
        ),
      ])
    })

    navList.append(
      el('ol', { class: 'guide-nav__parts' }, [
        overview
          ? el('li', { class: 'guide-nav__part' }, [
              el('ol', { class: 'guide-nav__list' }, [
                el('li', { class: 'guide-nav__item', 'data-id': overview.id }, [navLink(overview)]),
              ]),
            ])
          : null,
      ].concat(lists)),
    )
  }

  const setDrawer = function (open, restoreFocus) {
    if (!navRoot) return
    const active = open && drawerMode.matches
    root.classList.toggle('is-nav-open', active)
    document.documentElement.classList.toggle('guide-locked', active)
    if (navOpen) navOpen.setAttribute('aria-expanded', String(active))
    if (navScrim) navScrim.hidden = !active
    backdropRegions.forEach(function (region) {
      region.inert = active
    })
    if (active) {
      if (navClose) navClose.focus()
      const current = $('.guide-nav__link[aria-current]', navRoot)
      keepInView(navRoot, current)
    } else if (restoreFocus && navOpen) {
      navOpen.focus()
    }
  }

  if (navOpen) {
    navOpen.addEventListener('click', function () {
      setDrawer(true)
    })
  }
  if (navClose) {
    navClose.addEventListener('click', function () {
      setDrawer(false, true)
    })
  }
  if (navScrim) {
    navScrim.addEventListener('click', function () {
      setDrawer(false, true)
    })
  }
  drawerMode.addEventListener('change', function () {
    setDrawer(false)
  })

  const rail = $('.guide-rail', root)
  const railTitle = $('[data-guide-rail-title]', root)
  const railList = $('[data-guide-rail-list]', root)
  const railLinks = new Map()

  const renderRail = function (section) {
    if (!railList || !railTitle) return
    railTitle.textContent = section.level === 1 ? 'Overview' : section.title
    railLinks.clear()
    railList.replaceChildren.apply(
      railList,
      childrenOf(section).map(function (sub) {
        const link = el('a', { href: '#' + sub.id, text: sub.title })
        railLinks.set(sub.id, link)
        return el('li', null, [link])
      }),
    )
  }

  root.addEventListener('click', function (event) {
    const link = event.target.closest('a[href^="#"]')
    if (!link || !root.contains(link) || content.contains(link)) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    const record = byId.get(link.getAttribute('href').slice(1)) || overview
    event.preventDefault()
    setDrawer(false)
    goTo(record, true)
  })

  content.addEventListener('click', function (event) {
    const anchor = event.target.closest('.heading-anchor')
    if (!anchor || event.metaKey || event.ctrlKey) return
    event.preventDefault()
    const hash = anchor.getAttribute('href')
    window.history.replaceState(null, '', hash)
    const url = window.location.href
    const copy = window.fieldGuide && window.fieldGuide.copyText
    if (!copy) return
    copy(url).then(function (copied) {
      toast(copied ? 'Link copied' : 'Link is in the address bar')
    })
  })

  const current = $('[data-guide-current]', root)
  const progressBars = $$('[data-guide-progress]')
  const progressLabel = $('[data-guide-progress-label]', root)
  const spy = records.filter(function (record) {
    return record.level <= 3
  })
  let offsets = []
  let stale = true
  let activeSection = null
  let activeSub = null
  let frame = 0

  const offsetTop = function () {
    const sticky = drawerMode.matches ? mobilebar : header
    return sticky ? Math.max(0, sticky.getBoundingClientRect().bottom) : 0
  }

  const syncOffset = function () {
    const sticky = drawerMode.matches ? mobilebar : header
    const height = sticky ? sticky.offsetHeight : 0
    document.body.style.setProperty('--g-offset', String(height) + 'px')
  }

  const measure = function () {
    offsets = spy.map(function (record) {
      return record.element.getBoundingClientRect().top + window.scrollY
    })
    stale = false
  }

  const lastBefore = function (line) {
    let low = 0
    let high = offsets.length - 1
    let found = 0
    while (low <= high) {
      const mid = (low + high) >> 1
      if (offsets[mid] <= line) {
        found = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return found
  }

  const markCurrent = function (links, id) {
    links.forEach(function (link, key) {
      if (key === id) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    })
  }

  const setSection = function (section) {
    if (section === activeSection) return
    activeSection = section
    $$('.guide-nav__item.is-active', root).forEach(function (item) {
      item.classList.remove('is-active')
    })
    const link = navLinks.get(section.id)
    if (link) link.closest('.guide-nav__item').classList.add('is-active')
    if (current) current.textContent = section.level === 1 ? 'Overview' : section.title
    renderRail(section)
  }

  const setSub = function (sub) {
    const id = (sub || activeSection).id
    if (activeSub === id) return
    activeSub = id
    markCurrent(navLinks, id)
    markCurrent(railLinks, sub ? sub.id : '')
    if (navRoot && !navRoot.matches(':hover, :focus-within') && !drawerMode.matches) {
      keepInView(navRoot, navLinks.get(id))
    }
    if (rail && sub && !rail.matches(':hover, :focus-within')) keepInView(rail, railLinks.get(sub.id))
  }

  const update = function () {
    frame = 0
    if (!spy.length) return
    if (stale) measure()
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    const line = window.scrollY + (atEnd ? window.innerHeight / 2 : offsetTop() + 32)
    const active = spy[lastBefore(line)]
    const section = active.level === 3 ? active.h2 : active
    setSection(section)
    setSub(active.level === 3 ? active : null)

    const start = content.getBoundingClientRect().top + window.scrollY
    const end = start + content.offsetHeight - window.innerHeight
    const ratio = Math.max(0, Math.min(1, end <= start ? 1 : (window.scrollY - start) / (end - start)))
    progressBars.forEach(function (bar) {
      bar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')'
    })
    if (progressLabel) progressLabel.textContent = String(Math.round(ratio * 100)) + '%'
  }

  const schedule = function (remeasure) {
    if (remeasure) stale = true
    if (!frame) frame = window.requestAnimationFrame(update)
  }

  window.addEventListener('scroll', function () {
    schedule(false)
  }, { passive: true })
  window.addEventListener('resize', function () {
    syncOffset()
    schedule(true)
  })
  window.addEventListener('load', function () {
    schedule(true)
  })
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      schedule(true)
    }).observe(content)
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      syncOffset()
      schedule(true)
    })
  }

  const readingTime = $('[data-guide-reading-time]', root)
  if (readingTime) {
    const words = records.reduce(function (total, record) {
      return total + record.text.split(' ').filter(Boolean).length
    }, 0)
    readingTime.textContent = String(Math.max(1, Math.round(words / 230)))
  }

  $$('table', content).forEach(function (table) {
    const owner = records
      .slice()
      .reverse()
      .find(function (record) {
        return record.element.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING
      })
    const wrap = el('div', {
      class: 'guide-table',
      role: 'region',
      tabindex: '0',
      'aria-label': 'Table: ' + (owner ? owner.title : 'reference'),
    })
    table.replaceWith(wrap)
    wrap.append(table)
    $$('td', table).forEach(function (cell) {
      const value = cell.textContent.trim()
      if (value === '✓') cell.classList.add('is-yes')
      if (value === '✗') cell.classList.add('is-no')
    })
  })

  $$(':scope > blockquote', content).forEach(function (quote) {
    const caution = /^(deprecated|warning|caution|breaking)|experimental|\bremoved\b/i.test(
      quote.textContent.trim(),
    )
    quote.classList.add('guide-callout')
    quote.dataset.tone = caution ? 'caution' : 'note'
    quote.prepend(el('span', { class: 'guide-callout__label', text: caution ? 'Caution' : 'Note' }))
  })

  const palette = $('[data-guide-palette]')
  const input = $('[data-guide-palette-input]')
  const results = $('[data-guide-palette-results]')
  const status = $('[data-guide-palette-status]')
  const closeButton = $('[data-guide-palette-close]')
  const openers = $$('[data-guide-search-open]')
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  let options = []
  let activeOption = -1
  let opener = null

  $$('[data-guide-shortcut]').forEach(function (node) {
    node.textContent = isMac ? '⌘K' : 'Ctrl K'
  })

  const escapeRegExp = function (value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  const tokenize = function (query) {
    return Array.from(new Set(query.toLowerCase().split(/\s+/).filter(Boolean))).slice(0, 6)
  }

  const count = function (haystack, needle) {
    let total = 0
    let at = haystack.indexOf(needle)
    while (at >= 0 && total < 8) {
      total += 1
      at = haystack.indexOf(needle, at + needle.length)
    }
    return total
  }

  const startsWord = function (haystack, at) {
    return at === 0 || !/[a-z0-9]/.test(haystack.charAt(at - 1))
  }

  const scoreOf = function (record, tokens, phrase) {
    let score = 0
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]
      const inTitle = record.titleLower.indexOf(token)
      if (inTitle >= 0) score += startsWord(record.titleLower, inTitle) ? 12 : 7
      else if (record.textLower.indexOf(token) >= 0) score += 2 + Math.min(4, count(record.textLower, token))
      else if (record.codeLower.indexOf(token) >= 0) score += 1.5
      else if (record.trailLower.indexOf(token) >= 0) score += 1
      else return 0
    }
    if (record.titleLower === phrase) score += 24
    else if (tokens.length > 1 && record.titleLower.indexOf(phrase) >= 0) score += 10
    else if (tokens.length > 1 && record.textLower.indexOf(phrase) >= 0) score += 4
    return score + (record.level === 2 ? 2 : record.level === 3 ? 1 : 0)
  }

  const excerptOf = function (record, tokens) {
    const pick = function (source, lower) {
      const hits = tokens
        .map(function (token) {
          return lower.indexOf(token)
        })
        .filter(function (at) {
          return at >= 0
        })
      if (!hits.length) return null
      const at = Math.min.apply(Math, hits)
      let start = Math.max(0, at - 56)
      if (start > 0) start = source.indexOf(' ', start) + 1 || start
      const end = Math.min(source.length, start + 170)
      return (start > 0 ? '…' : '') + source.slice(start, end).trim() + (end < source.length ? '…' : '')
    }
    const prose = pick(record.text, record.textLower)
    if (prose) return { value: prose, code: false }
    const code = pick(record.code, record.codeLower)
    if (code) return { value: code, code: true }
    return record.text ? { value: record.text.slice(0, 170) + (record.text.length > 170 ? '…' : ''), code: false } : null
  }

  const highlighted = function (value, tokens) {
    if (!tokens.length) return [document.createTextNode(value)]
    const pattern = new RegExp(
      '(' +
        tokens
          .slice()
          .sort(function (a, b) {
            return b.length - a.length
          })
          .map(escapeRegExp)
          .join('|') +
        ')',
      'gi',
    )
    return value.split(pattern).map(function (part, index) {
      return index % 2 ? el('mark', { text: part }) : document.createTextNode(part)
    })
  }

  const optionFor = function (record, tokens, index) {
    const excerpt = tokens.length ? excerptOf(record, tokens) : null
    const link = el(
      'a',
      {
        class: 'guide-result',
        href: '#' + record.id,
        role: 'option',
        id: 'guide-option-' + String(index),
        'aria-selected': 'false',
      },
      [
        record.trail && tokens.length ? el('span', { class: 'guide-result__trail', text: record.trail }) : null,
        el('span', { class: 'guide-result__title' }, highlighted(record.level === 1 ? 'Overview' : record.title, tokens)),
        excerpt
          ? el('span', { class: 'guide-result__excerpt' + (excerpt.code ? ' is-code' : '') }, highlighted(excerpt.value, tokens))
          : null,
      ],
    )
    link.guideRecord = record
    return el('li', { role: 'presentation' }, [link])
  }

  const setActiveOption = function (index) {
    if (!options.length || !input) {
      activeOption = -1
      if (input) input.removeAttribute('aria-activedescendant')
      return
    }
    activeOption = (index + options.length) % options.length
    options.forEach(function (option, optionIndex) {
      option.setAttribute('aria-selected', String(optionIndex === activeOption))
    })
    input.setAttribute('aria-activedescendant', options[activeOption].id)
    keepInView(results, options[activeOption])
  }

  const renderBrowse = function () {
    let index = 0
    const nodes = (overview ? [optionFor(overview, [], index++)] : []).concat(
      groupByPart(sections).reduce(function (all, group) {
        return all
          .concat(el('li', { class: 'guide-palette__group', role: 'presentation', text: group.title || 'Sections' }))
          .concat(
            group.items.map(function (section) {
              return optionFor(section, [], index++)
            }),
          )
      }, []),
    )
    results.replaceChildren.apply(results, nodes)
    status.textContent = 'Type to search ' + String(records.length) + ' sections, or jump to one below.'
  }

  const renderMatches = function (query) {
    const tokens = tokenize(query)
    const phrase = tokens.join(' ')
    const matches = records
      .map(function (record) {
        return { record: record, score: scoreOf(record, tokens, phrase) }
      })
      .filter(function (match) {
        return match.score > 0
      })
      .sort(function (a, b) {
        return b.score - a.score || a.record.index - b.record.index
      })
    const shown = matches.slice(0, 40)
    results.replaceChildren.apply(
      results,
      shown.map(function (match, index) {
        return optionFor(match.record, tokens, index)
      }),
    )
    status.textContent = matches.length
      ? String(matches.length) + (matches.length === 1 ? ' section matches' : ' sections match') +
        (matches.length > shown.length ? ', showing the best ' + String(shown.length) : '')
      : 'No section mentions "' + query.trim() + '". Try one term, such as an option or operation name.'
  }

  const render = function () {
    if (!input || !results || !status) return
    const query = input.value.trim()
    if (query) renderMatches(query)
    else renderBrowse()
    options = $$('[role="option"]', results)
    results.scrollTop = 0
    if (query) {
      setActiveOption(0)
    } else {
      activeOption = -1
      input.removeAttribute('aria-activedescendant')
    }
  }

  const openPalette = function () {
    if (!palette || palette.open) return
    opener = document.activeElement
    setDrawer(false)
    palette.showModal()
    document.documentElement.classList.add('guide-locked')
    render()
    input.focus()
    input.select()
  }

  const closePalette = function () {
    if (palette && palette.open) palette.close()
  }

  const choose = function (option) {
    if (!option || !option.guideRecord) return
    const record = option.guideRecord
    opener = null
    closePalette()
    goTo(record, true)
  }

  if (palette && input && results) {
    palette.addEventListener('close', function () {
      document.documentElement.classList.remove('guide-locked')
      if (opener && typeof opener.focus === 'function') opener.focus()
      opener = null
    })
    palette.addEventListener('click', function (event) {
      if (event.target === palette) closePalette()
    })
    input.addEventListener('input', render)
    input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveOption(activeOption + 1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveOption(activeOption < 0 ? -1 : activeOption - 1)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        choose(options[Math.max(0, activeOption)])
      }
    })
    results.addEventListener('click', function (event) {
      const option = event.target.closest('[role="option"]')
      if (!option || event.metaKey || event.ctrlKey || event.shiftKey) return
      event.preventDefault()
      choose(option)
    })
    results.addEventListener('pointermove', function (event) {
      const option = event.target.closest('[role="option"]')
      const index = options.indexOf(option)
      if (index >= 0 && index !== activeOption) setActiveOption(index)
    })
    if (closeButton) closeButton.addEventListener('click', closePalette)
    openers.forEach(function (button) {
      button.addEventListener('click', openPalette)
    })
  }

  document.addEventListener('keydown', function (event) {
    const target = event.target
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      if (palette && palette.open) closePalette()
      else openPalette()
    } else if (event.key === '/' && !typing && !(palette && palette.open)) {
      event.preventDefault()
      openPalette()
    } else if (event.key === 'Escape' && root.classList.contains('is-nav-open')) {
      setDrawer(false, true)
    }
  })

  window.addEventListener('popstate', function () {
    const record = byId.get(decodeURIComponent(window.location.hash.slice(1)))
    if (record) goTo(record, false)
  })

  syncOffset()
  update()
})()
