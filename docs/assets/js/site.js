(function () {
  "use strict";

  const article = document.querySelector(".article-body");

  if (!article) {
    return;
  }

  const codeLanguages = {
    bash: "Shell",
    http: "HTTP",
    json: "JSON",
    plaintext: "Output",
    prisma: "Prisma Schema",
    sh: "Shell",
    text: "Output",
    ts: "TypeScript",
    typescript: "TypeScript",
  };

  const getCodeLanguage = function (codeBlock) {
    let element = codeBlock;

    while (element && element !== article) {
      const match = element.className.match(/(?:^|\s)language-([\w-]+)/);

      if (match) {
        return match[1].toLowerCase();
      }

      element = element.parentElement;
    }

    return "text";
  };

  const configurePrism = function () {
    if (!window.Prism) {
      return;
    }

    window.Prism.languages.insertBefore("bash", "function", {
      "package-runner": {
        pattern: /(^[\t ]*|[;&|][\t ]*)npx(?=\s|$)/m,
        lookbehind: true,
        alias: "function",
      },
    });
    window.Prism.languages.ts = window.Prism.languages.typescript;
    window.Prism.languages.sh = window.Prism.languages.bash;
    window.Prism.languages.prisma = {
      comment: /\/\/.*/,
      string: {
        pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true,
      },
      annotation: {
        pattern: /@@?\w+(?:\.\w+)?/,
        alias: "attr-name",
      },
      keyword: /\b(?:datasource|enum|generator|model|type|view)\b/,
      builtin: /\b(?:BigInt|Boolean|Bytes|DateTime|Decimal|Float|Int|Json|String|Unsupported)\b/,
      function: /\b(?:env|relation)\b(?=\s*\()/,
      boolean: /\b(?:false|true)\b/,
      number: /\b(?:0x[\dA-Fa-f]+|\d+(?:\.\d+)?)\b/,
      operator: /[=?]|\[\]/,
      punctuation: /[{}()[\],.:]/,
    };
  };

  configurePrism();

  const slugify = function (value) {
    return value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const getHeadingText = function (heading) {
    return Array.from(heading.childNodes)
      .filter(function (node) {
        return !(node.nodeType === 1 && node.classList.contains("heading-anchor"));
      })
      .map(function (node) {
        return node.textContent;
      })
      .join("")
      .trim();
  };

  const headings = Array.from(article.querySelectorAll("h2, h3"));
  const usedIds = new Set(
    Array.from(document.querySelectorAll("[id]")).map(function (element) {
      return element.id;
    })
  );

  headings.forEach(function (heading, index) {
    const headingText = getHeadingText(heading);

    if (!heading.id) {
      const baseId = slugify(headingText) || "section-" + String(index + 1);
      let candidate = baseId;
      let suffix = 2;

      while (usedIds.has(candidate)) {
        candidate = baseId + "-" + String(suffix);
        suffix += 1;
      }

      heading.id = candidate;
      usedIds.add(candidate);
    }

    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = "#" + heading.id;
    anchor.setAttribute("aria-label", "Permalink to " + headingText);
    anchor.innerHTML = '<span aria-hidden="true">#</span>';
    heading.appendChild(anchor);
  });

  const toc = document.querySelector("[data-article-toc]");
  const tocList = toc ? toc.querySelector("[data-toc-list]") : null;
  const tocToggle = toc ? toc.querySelector("[data-toc-toggle]") : null;
  const sectionHeadings = headings.filter(function (heading) {
    return heading.tagName === "H2";
  });

  if (toc && tocList && sectionHeadings.length) {
    const linksById = new Map();

    sectionHeadings.forEach(function (heading) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = getHeadingText(heading);
      item.appendChild(link);
      tocList.appendChild(item);
      linksById.set(heading.id, link);

      link.addEventListener("click", function () {
        if (tocToggle && window.matchMedia("(max-width: 68rem)").matches) {
          toc.classList.remove("is-open");
          tocToggle.setAttribute("aria-expanded", "false");
          const indicator = tocToggle.lastElementChild;
          if (indicator) {
            indicator.textContent = "+";
          }
        }
      });
    });

    toc.hidden = false;

    if (tocToggle) {
      tocToggle.addEventListener("click", function () {
        const isOpen = toc.classList.toggle("is-open");
        tocToggle.setAttribute("aria-expanded", String(isOpen));
        const indicator = tocToggle.lastElementChild;
        if (indicator) {
          indicator.textContent = isOpen ? "−" : "+";
        }
      });
    }

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) {
              return;
            }

            linksById.forEach(function (link) {
              link.removeAttribute("aria-current");
            });

            const currentLink = linksById.get(entry.target.id);
            if (currentLink) {
              currentLink.setAttribute("aria-current", "location");
            }
          });
        },
        { rootMargin: "-15% 0px -70% 0px" }
      );

      sectionHeadings.forEach(function (heading) {
        observer.observe(heading);
      });
    }
  }

  const legacyCopy = function (text) {
    if (!document.body || typeof document.execCommand !== "function") {
      return false;
    }

    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.inset = "-9999px auto auto -9999px";
    document.body.appendChild(field);
    field.select();

    try {
      return document.execCommand("copy");
    } catch (error) {
      return false;
    } finally {
      field.remove();
    }
  };

  const copyText = async function (text) {
    if (
      window.isSecureContext &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        return legacyCopy(text);
      }
    }

    return legacyCopy(text);
  };

  const selectCode = function (codeBlock) {
    const selection = window.getSelection();

    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(codeBlock);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  Array.from(article.querySelectorAll("pre")).forEach(function (codeBlock) {
    const code = codeBlock.querySelector("code");
    const sourceLanguage = getCodeLanguage(code || codeBlock);
    const prismLanguage = sourceLanguage === "ts" ? "typescript" : sourceLanguage;

    if (code && window.Prism && window.Prism.languages[prismLanguage]) {
      code.className = "language-" + prismLanguage;
      window.Prism.highlightElement(code);
    }

    const highlight = codeBlock.closest(".highlight");
    const codeSurface = highlight || codeBlock;
    const parent = codeSurface.parentNode;

    if (!parent || codeSurface.closest(".code-block")) {
      return;
    }

    const container = document.createElement("div");
    container.className = "code-block";
    if (codeBlock.textContent.trim().split("\n").length <= 2) {
      container.classList.add("code-block--compact");
    }
    parent.insertBefore(container, codeSurface);
    container.appendChild(codeSurface);

    const toolbar = document.createElement("div");
    const languageLabel = document.createElement("span");
    const button = document.createElement("button");
    const label = document.createElement("span");
    const status = document.createElement("span");
    toolbar.className = "code-toolbar";
    languageLabel.className = "code-language";
    languageLabel.textContent = codeLanguages[sourceLanguage] || sourceLanguage;
    button.className = "copy-button";
    button.type = "button";
    button.setAttribute("aria-label", "Copy code");
    label.textContent = "Copy";
    status.className = "visually-hidden";
    status.setAttribute("aria-live", "polite");
    button.appendChild(label);
    toolbar.appendChild(languageLabel);
    toolbar.appendChild(button);
    container.insertBefore(toolbar, container.firstChild);
    container.insertBefore(status, codeSurface);

    button.addEventListener("click", async function () {
      button.disabled = true;
      const copied = await copyText(codeBlock.textContent);

      if (copied) {
        label.textContent = "Copied";
        button.setAttribute("aria-label", "Code copied");
        status.textContent = "Code copied to clipboard.";
      } else {
        label.textContent = "Select code";
        button.setAttribute("aria-label", "Copy failed; code selected for manual copying");
        status.textContent = "Copy failed. The code is selected for manual copying.";
        selectCode(codeBlock);
      }

      window.setTimeout(function () {
        label.textContent = "Copy";
        button.setAttribute("aria-label", "Copy code");
        status.textContent = "";
        button.disabled = false;
      }, 2200);
    });
  });
})();
