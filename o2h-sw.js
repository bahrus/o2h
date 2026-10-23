// o2h service worker: built by worker/build.mjs from worker/serviceWorker.ts. Do not edit.
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../assign-gingerly/resolve/getValues.js
function normalizeAliasOptions(options) {
  const aliasMap = /* @__PURE__ */ new Map();
  if (options?.aka) {
    for (const [alias, target] of Object.entries(options.aka)) {
      if (alias.includes(" ") || alias.includes("`")) {
        throw new Error(`Invalid alias '${alias}': aliases cannot contain space or backtick characters`);
      }
      aliasMap.set(alias, target);
    }
  }
  if (options?.akaMethods) {
    for (const [alias, target] of Object.entries(options.akaMethods)) {
      if (alias.includes(" ") || alias.includes("`")) {
        throw new Error(`Invalid alias '${alias}': aliases cannot contain space or backtick characters`);
      }
      aliasMap.set(alias, target);
    }
  }
  const withMethods = options?.withMethods ? options.withMethods instanceof Set ? new Set(options.withMethods) : new Set(options.withMethods) : options?.akaMethods ? /* @__PURE__ */ new Set() : void 0;
  if (options?.akaMethods) {
    for (const target of Object.values(options.akaMethods)) {
      withMethods?.add(target);
    }
  }
  return { aliasMap, withMethods };
}
function isAllowedMethod(methodName, withMethods, permissionProcessor) {
  return !!withMethods && withMethods.has(methodName) && !permissionProcessor?.checkRestrictedMethod(methodName);
}
function applyAliases(path, aliasMap) {
  if (aliasMap.size === 0)
    return path;
  const parts = path.split("?.");
  const substituted = parts.map((part) => aliasMap.get(part) ?? part);
  return substituted.join("?.");
}
function applySubstitutions(path, substitutionMap) {
  if (!substitutionMap || substitutionMap.size === 0)
    return path;
  const parts = path.split("?.");
  const substituted = parts.map((part) => substitutionMap.get(part) ?? part);
  return substituted.join("?.");
}
function resolveSubstitutions(substitutions, source, options) {
  const map = /* @__PURE__ */ new Map();
  if (!substitutions)
    return map;
  for (const [name, path] of Object.entries(substitutions)) {
    const resolved = getValue(path, source, options ? { ...options, substitutions: void 0, root: void 0, fromStack: void 0 } : void 0);
    if (resolved === null || typeof resolved === "undefined")
      continue;
    if (typeof resolved !== "string") {
      throw new Error(`Substitution '${name}' must resolve to a string, got ${typeof resolved}`);
    }
    if (resolved.includes("?.")) {
      throw new Error(`Substitution '${name}' resolved to a string containing '?.', which would alter the path structure: '${resolved}'`);
    }
    map.set(name, resolved);
  }
  return map;
}
function fromStackToken(path) {
  for (const token of [ROOT_REF, PARENT_REF]) {
    if (path.startsWith(token) && (path.length === token.length || path.startsWith("?.", token.length))) {
      return token;
    }
  }
  return void 0;
}
function isFromStackReference(value2) {
  return fromStackToken(value2) !== void 0;
}
function isRootReference(value2) {
  return value2.startsWith("$0") || fromStackToken(value2) !== void 0;
}
function resolveRootReference(path, source, options) {
  if (path === "$0")
    return { source: options?.root ?? source, path: "" };
  if (path.startsWith("$0?."))
    return { source: options?.root ?? source, path: path.substring(4) };
  const token = fromStackToken(path);
  if (token === void 0)
    return null;
  const fromStack = options?.fromStack;
  const refSource = token === ROOT_REF ? fromStack?.length ? fromStack[0] : source : fromStack?.[fromStack.length - 1];
  return { source: refSource, path: path.substring(token.length) };
}
function parseCachedPath(path) {
  let parts = pathCache.get(path);
  if (!parts) {
    parts = path.split("?.").filter((p) => p.length > 0);
    pathCache.set(path, parts);
  }
  return parts;
}
function isPipe(part, pipes) {
  return !!pipes && Object.hasOwn(pipes, part);
}
function navigatePath(source, parts, withMethods, permissionProcessor, pipes) {
  let current = source;
  let i = 0;
  while (i < parts.length) {
    if (current == null)
      return current;
    const rawPart = parts[i];
    if (isPipe(rawPart, pipes)) {
      const pipe = pipes[rawPart];
      current = pipe(current);
      i++;
      continue;
    }
    const isZeroArg = rawPart.endsWith("|") && isAllowedMethod(rawPart.slice(0, -1), withMethods, permissionProcessor);
    const part = isZeroArg ? rawPart.slice(0, -1) : rawPart;
    if (isZeroArg || isAllowedMethod(part, withMethods, permissionProcessor)) {
      const method = current[part];
      if (typeof method === "function") {
        const nextPart = parts[i + 1];
        const nextIsMethod = nextPart !== void 0 && (isAllowedMethod(nextPart, withMethods, permissionProcessor) || nextPart.endsWith("|") && isAllowedMethod(nextPart.slice(0, -1), withMethods, permissionProcessor) || isPipe(nextPart, pipes));
        if (!isZeroArg && nextPart !== void 0 && !nextIsMethod) {
          current = method.call(current, nextPart);
          i += 2;
        } else {
          current = method.call(current);
          i++;
        }
      } else {
        current = current[part];
        i++;
      }
    } else {
      current = current[rawPart];
      i++;
    }
  }
  return current;
}
function hasProtocol(value2) {
  return value2.includes("://");
}
function parseProtocolRef(value2) {
  const protoEnd = value2.indexOf("://");
  if (protoEnd === -1)
    return { protocol: "", key: value2, path: null };
  const protocol = value2.substring(0, protoEnd);
  const rest = value2.substring(protoEnd + 3);
  const pathStart = rest.indexOf("?.");
  const key = pathStart === -1 ? rest : rest.substring(0, pathStart);
  const path = pathStart === -1 ? null : rest.substring(pathStart);
  return { protocol, key, path };
}
function isPlainObject(value2) {
  if (!value2 || typeof value2 !== "object")
    return false;
  const proto = Object.getPrototypeOf(value2);
  return proto === Object.prototype || proto === null;
}
function isEventBinding(key, value2) {
  return key.endsWith(" +=") && isPlainObject(value2) && "on" in value2;
}
function parseNegationMarker(value2) {
  let count = 0;
  while (count < value2.length && value2.charCodeAt(count) === 33)
    count++;
  if (count === 0)
    return null;
  return { count, rest: value2.slice(count) };
}
function looksLikeReference(value2, protocols) {
  return value2.startsWith("?.") || isRootReference(value2) || !!protocols && hasProtocol(value2);
}
function isReferenceString(value2, protocols) {
  if (value2.charCodeAt(0) === 33) {
    const neg = parseNegationMarker(value2);
    return neg !== null && looksLikeReference(neg.rest, protocols);
  }
  return looksLikeReference(value2, protocols);
}
function resolveReferenceString(value2, source, aliasMap, withMethods, protocols, options, substitutionMap) {
  const permissionProcessor = options?.permissionProcessor;
  if (value2.startsWith("?.")) {
    const substituted = applySubstitutions(value2, substitutionMap);
    const aliased = applyAliases(substituted, aliasMap);
    const parts = parseCachedPath(aliased);
    return parts.length === 0 ? source : navigatePath(source, parts, withMethods, permissionProcessor, options?.pipes);
  }
  if (isRootReference(value2)) {
    const rootRef = resolveRootReference(value2, source, options);
    if (rootRef === null)
      return source;
    const substitutedPath = applySubstitutions(rootRef.path, substitutionMap);
    const aliased = applyAliases(substitutedPath, aliasMap);
    const normalizedPath = aliased.startsWith("?.") ? aliased : aliased ? `?.${aliased}` : "?.";
    const parts = parseCachedPath(normalizedPath);
    return parts.length === 0 ? rootRef.source : navigatePath(rootRef.source, parts, withMethods, permissionProcessor, options?.pipes);
  }
  return getProtocolValue(value2, protocols, options);
}
function resolveStringValue(value2, source, aliasMap, withMethods, protocols, options, substitutionMap) {
  if (value2.charCodeAt(0) === 33) {
    const neg = parseNegationMarker(value2);
    if (neg !== null && looksLikeReference(neg.rest, protocols)) {
      let resolved = resolveReferenceString(neg.rest, source, aliasMap, withMethods, protocols, options, substitutionMap);
      for (let i = 0; i < neg.count; i++)
        resolved = !resolved;
      return resolved;
    }
    return value2;
  }
  if (looksLikeReference(value2, protocols)) {
    return resolveReferenceString(value2, source, aliasMap, withMethods, protocols, options, substitutionMap);
  }
  return value2;
}
function getProtocolValue(value2, protocols, options) {
  const { protocol, key, path } = parseProtocolRef(value2);
  const handler = protocols[protocol];
  if (!handler)
    return value2;
  const resolved = handler(key);
  if (path) {
    return getValue(path, resolved, options);
  }
  return resolved;
}
function getArray(arr2, source, aliasMap, withMethods, protocols, options, substitutionMap) {
  const result = [];
  for (const item of arr2) {
    if (typeof item === "string") {
      result.push(resolveStringValue(item, source, aliasMap, withMethods, protocols, options, substitutionMap));
    } else if (Array.isArray(item)) {
      result.push(getArray(item, source, aliasMap, withMethods, protocols, options, substitutionMap));
    } else if (item && typeof item === "object") {
      result.push(isPlainObject(item) ? getValues(item, source, options) : item);
    } else {
      result.push(item);
    }
  }
  return result;
}
function getValues(pattern, source, options) {
  const { aliasMap, withMethods } = normalizeAliasOptions(options);
  const substitutionMap = resolveSubstitutions(options?.substitutions, source, options);
  const protocols = options?.protocols;
  const result = {};
  for (const [key, value2] of Object.entries(pattern)) {
    if (typeof value2 === "string") {
      result[key] = resolveStringValue(value2, source, aliasMap, withMethods, protocols, options, substitutionMap);
    } else if (Array.isArray(value2)) {
      result[key] = getArray(value2, source, aliasMap, withMethods, protocols, options, substitutionMap);
    } else if (isEventBinding(key, value2)) {
      const { get } = value2;
      result[key] = isPlainObject(get) ? { ...value2, get: getValues(get, source, options) } : value2;
    } else if (typeof value2 === "object" && value2 !== null) {
      result[key] = isPlainObject(value2) ? getValues(value2, source, options) : value2;
    } else {
      result[key] = value2;
    }
  }
  return result;
}
function getValue(path, source, options) {
  const neg = parseNegationMarker(path);
  if (neg !== null && (neg.rest.startsWith("?.") || isRootReference(neg.rest))) {
    let resolved = getValue(neg.rest, source, options);
    for (let i = 0; i < neg.count; i++)
      resolved = !resolved;
    return resolved;
  }
  const rootRef = resolveRootReference(path, source, options);
  if (rootRef) {
    path = rootRef.path;
    source = rootRef.source;
  } else if (!path.startsWith("?.")) {
    return path;
  }
  const substitutionMap = resolveSubstitutions(options?.substitutions, source, options);
  const substituted = applySubstitutions(path, substitutionMap);
  let aliased = substituted;
  const { aliasMap } = normalizeAliasOptions(options);
  if (aliasMap.size > 0) {
    aliased = applyAliases(substituted, aliasMap);
  }
  const normalizedPath = aliased.startsWith("?.") ? aliased : aliased ? `?.${aliased}` : "?.";
  const parts = parseCachedPath(normalizedPath);
  if (parts.length === 0)
    return source;
  const { withMethods } = normalizeAliasOptions(options);
  const permissionProcessor = options?.permissionProcessor;
  return navigatePath(source, parts, withMethods, permissionProcessor, options?.pipes);
}
var ROOT_REF, PARENT_REF, pathCache;
var init_getValues = __esm({
  "../assign-gingerly/resolve/getValues.js"() {
    ROOT_REF = "$root";
    PARENT_REF = "$parent";
    pathCache = /* @__PURE__ */ new Map();
  }
});

// ../assign-gingerly/handlers/treeSpec.js
function isSwitch(spec) {
  return !!spec && typeof spec === "object" && !Array.isArray(spec) && "switch" in spec;
}
function checkSwitch(spec) {
  const { switch: on, cases } = spec;
  if (typeof on !== "string")
    throw new Error(`builtIns.tree: a switch needs a "switch" path, e.g. { switch: '?.status', cases: { \u2026 } }`);
  if (!cases || typeof cases !== "object" || Array.isArray(cases)) {
    throw new Error('builtIns.tree: a switch needs a "cases" object of case \u2192 specification');
  }
}
function textPattern(text) {
  let pattern = textPatterns.get(text);
  if (!pattern) {
    pattern = { textContent: text };
    textPatterns.set(text, pattern);
  }
  return pattern;
}
function isSnippet(spec) {
  return !!spec && typeof spec === "object" && !Array.isArray(spec) && "snippet" in spec;
}
function snippetSource(spec, snippets) {
  const html = snippets?.[spec.snippet];
  if (typeof html !== "string")
    throw new Error(`builtIns.tree: snippet "${spec.snippet}" isn't in the snippets option`);
  return html.trim();
}
function normalize(spec) {
  if (isSwitch(spec))
    throw new Error("builtIns.tree: a switch has no element of its own to normalize");
  if (isSnippet(spec))
    throw new Error("builtIns.tree: a snippet has no element of its own to normalize");
  const [header, patternOrText, third] = Array.isArray(spec) ? spec : [spec];
  const pattern = typeof patternOrText === "string" ? textPattern(patternOrText) : patternOrText;
  let children = [];
  let repeat;
  let nested;
  if (Array.isArray(third)) {
    children = third;
  } else if (third !== void 0) {
    if (third && typeof third === "object" && "each" in third) {
      repeat = third;
    } else if (third && typeof third === "object" && "map" in third) {
      nested = third;
    } else {
      throw new Error("builtIns.tree: the children slot must be an array of specifications, a repeat object { each, \u2026 } or a nested tree { map, \u2026 }");
    }
  }
  if (typeof header === "string") {
    if (header.startsWith("$:")) {
      throw new Error(`builtIns.tree: itemscope manager headers ("${header}") are not supported yet; use { tag, ish: '${header.slice(2)}' }`);
    }
    return [header, header, void 0, pattern, children, repeat, nested];
  }
  if (typeof header === "function") {
    throw new Error("builtIns.tree: class headers are not supported yet; use { tag, ish: Class }");
  }
  if (header && typeof header === "object" && typeof header.tag === "string") {
    return [header, header.tag, header.ish, pattern, children, repeat, nested];
  }
  throw new Error("builtIns.tree: an element header must be a tag name or { tag, ish? }");
}
function wildcardSpecOf(map) {
  const source = map[WILDCARD];
  if (isSwitch(source) || isSnippet(source))
    return source;
  const cached = wildcardSpecs.get(map);
  if (cached?.source === source)
    return cached.spec;
  const [header, , , pattern = DEFAULT_WILDCARD_PATTERN, children, repeat, nested] = normalize(source);
  const spec = [header, pattern, repeat ?? nested ?? children];
  wildcardSpecs.set(map, { source, spec });
  return spec;
}
function mapKeyName(key) {
  let name = keyNames.get(key);
  if (name !== void 0)
    return name;
  name = key;
  if (key.includes("/*") || key.includes("*/")) {
    const trimmed = key.trimEnd();
    const open2 = trimmed.indexOf("/*");
    if (open2 < 0 || !trimmed.endsWith("*/") || trimmed.indexOf("*/") !== trimmed.length - 2 || trimmed.indexOf("/*", open2 + 2) >= 0) {
      throw new Error(`builtIns.tree: map key "${key}": a comment in a map key goes at its end, once (e.g. 'rocket /* summary */')`);
    }
    name = trimmed.slice(0, open2).trim();
    if (name === "")
      throw new Error(`builtIns.tree: map key "${key}" is only a comment; put the VM key before it`);
  }
  keyNames.set(key, name);
  return name;
}
function mapEntries(map, from, keepNullish = false) {
  const entries = [];
  const push = (key, name, spec, templateKey) => {
    const value2 = from?.[name];
    if (value2 == null && !keepNullish)
      return;
    entries.push({ key, name, spec, value: value2, templateKey });
  };
  const named = /* @__PURE__ */ new Set();
  for (const key of Object.keys(map)) {
    if (key === WILDCARD)
      continue;
    const name = mapKeyName(key);
    named.add(name);
    push(key, name, map[key], key);
  }
  if (map[WILDCARD] === void 0 || from === null || typeof from !== "object")
    return entries;
  const wildcardSpec = wildcardSpecOf(map);
  for (const key of Object.keys(from)) {
    if (!named.has(key))
      push(key, key, wildcardSpec, WILDCARD);
  }
  return entries;
}
function chooseCase(spec, value2, resolve) {
  checkSwitch(spec);
  const { switch: on, cases, default: fallback } = spec;
  const discriminant = resolve(on, value2);
  const caseName = discriminant == null ? void 0 : String(discriminant);
  if (caseName !== void 0 && Object.hasOwn(cases, caseName))
    return { caseKey: caseName, spec: cases[caseName] };
  return { caseKey: DEFAULT_CASE, spec: fallback };
}
function repeatItems(repeat, value2, resolve) {
  const { of = "?.", key, empty } = repeat;
  const list = resolve(of, value2);
  const items = list != null && typeof list[Symbol.iterator] === "function" ? Array.from(list) : [];
  const keys = new Array(items.length);
  const seen = /* @__PURE__ */ new Set();
  let duplicate;
  let hasDuplicate = false;
  for (let index = 0; index < items.length; index++) {
    let itemKey = key === void 0 ? index : resolve(key, items[index], true);
    if (seen.has(itemKey)) {
      if (!hasDuplicate) {
        hasDuplicate = true;
        duplicate = itemKey;
      }
      itemKey = /* @__PURE__ */ Symbol.for(`builtIns.tree:index:${index}`);
    }
    seen.add(itemKey);
    keys[index] = itemKey;
  }
  const result = { items, keys, pushesHolder: of !== "?." };
  if (hasDuplicate)
    result.duplicate = duplicate;
  if (items.length === 0 && empty !== void 0)
    result.empty = empty;
  return result;
}
function decodeEntities(text) {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (whole, ref) => {
    if (ref[0] !== "#")
      return ENTITIES[ref] ?? whole;
    return String.fromCodePoint(ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10));
  });
}
function* tokens(html) {
  let i = 0;
  while (true) {
    const lt = html.indexOf("<", i);
    if (lt < 0)
      return;
    if (html.startsWith("<!--", lt)) {
      const e = html.indexOf("-->", lt + 4);
      i = e < 0 ? html.length : e + 3;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const e = html.indexOf(">", lt);
      i = e < 0 ? html.length : e + 1;
      continue;
    }
    const isEnd = html[lt + 1] === "/";
    const nameAt = lt + (isEnd ? 2 : 1);
    const name = match(TAG_NAME, html, nameAt);
    if (!name) {
      i = lt + 1;
      continue;
    }
    let p = nameAt + name.length;
    if (isEnd) {
      const e = html.indexOf(">", p);
      i = e < 0 ? html.length : e + 1;
      yield { kind: "end", name, start: lt, end: i, attrs: [], closed: false };
      continue;
    }
    const attrs = [];
    let selfClosed = false;
    while (p < html.length) {
      const before = p;
      while (p < html.length && /\s/.test(html[p]))
        p++;
      if (html[p] === ">") {
        p++;
        break;
      }
      if (html.startsWith("/>", p)) {
        selfClosed = true;
        p += 2;
        break;
      }
      if (html[p] === "/") {
        p++;
        continue;
      }
      const attrName = match(ATTR_NAME, html, p);
      if (!attrName) {
        p++;
        continue;
      }
      p += attrName.length;
      let value2 = "";
      let q = p;
      while (q < html.length && /\s/.test(html[q]))
        q++;
      if (html[q] === "=") {
        q++;
        while (q < html.length && /\s/.test(html[q]))
          q++;
        const quote = html[q];
        if (quote === '"' || quote === "'") {
          const e = html.indexOf(quote, q + 1);
          value2 = html.slice(q + 1, e < 0 ? html.length : e);
          p = e < 0 ? html.length : e + 1;
        } else {
          value2 = match(UNQUOTED, html, q) ?? "";
          p = q + value2.length;
        }
      }
      attrs.push({ name: attrName, value: decodeEntities(value2), start: before, end: p });
    }
    i = p;
    const lower = name.toLowerCase();
    yield { kind: "start", name, start: lt, end: i, attrs, closed: selfClosed || VOID_ELEMENTS.has(lower) };
    if (RAW_TEXT_ELEMENTS.has(lower) && !selfClosed) {
      const e = html.toLowerCase().indexOf(`</${lower}`, i);
      i = e < 0 ? html.length : e;
    }
  }
}
function snippetParts(html) {
  const parts = [];
  const open2 = [];
  const names = /* @__PURE__ */ new Set();
  let textStart = 0;
  const it = tokens(html);
  for (let next = it.next(); !next.done; next = it.next()) {
    const token = next.value;
    if (token.kind === "end") {
      const k = open2.lastIndexOf(token.name.toLowerCase());
      if (k >= 0)
        open2.length = k;
      continue;
    }
    const holeAttr = token.attrs.find((a) => a.name.toLowerCase() === HOLE);
    if (!holeAttr) {
      if (!token.closed)
        open2.push(token.name.toLowerCase());
      continue;
    }
    const hole = holeAttr.value;
    if (names.has(hole))
      throw new Error(`snippet: two holes named "${hole}"`);
    names.add(hole);
    if (open2.includes("template"))
      throw new Error(`snippet: a hole ("${hole}") inside a <template>, which isn't supported (yet)`);
    let close;
    if (!token.closed) {
      const inside = [];
      for (let inner = it.next(); !inner.done; inner = it.next()) {
        const t = inner.value;
        const name = t.name.toLowerCase();
        if (t.kind === "start") {
          if (t.attrs.some((a) => a.name.toLowerCase() === HOLE))
            throw new Error(`snippet: a hole inside the hole "${hole}", which isn't supported`);
          if (!t.closed)
            inside.push(name);
        } else if (inside.length > 0 && inside[inside.length - 1] === name) {
          inside.pop();
        } else if (inside.length === 0 && name === token.name.toLowerCase()) {
          close = t;
          break;
        } else {
          throw new Error(`snippet: </${t.name}> in the hole "${hole}" where ${inside.length > 0 ? `<${inside[inside.length - 1]}>` : `<${token.name}>`} is open: holes and their contents must be well-formed (explicit end tags)`);
        }
      }
      if (!close)
        throw new Error(`snippet: the hole "${hole}" (<${token.name}>) has no end tag`);
    }
    if (token.start > textStart)
      parts.push(html.slice(textStart, token.start));
    parts.push({
      hole,
      tag: token.name,
      attrs: token.attrs.filter((a) => a !== holeAttr).map((a) => [a.name, a.value]),
      open: html.slice(token.start, holeAttr.start) + html.slice(holeAttr.end, token.end),
      fallback: close ? html.slice(token.end, close.start) : "",
      close: close ? html.slice(close.start, close.end) : ""
    });
    textStart = close ? close.end : token.end;
  }
  if (textStart < html.length)
    parts.push(html.slice(textStart));
  return parts;
}
var WILDCARD, DEFAULT_WILDCARD_PATTERN, textPatterns, wildcardSpecs, keyNames, DEFAULT_CASE, HOLE, VOID_ELEMENTS, RAW_TEXT_ELEMENTS, ENTITIES, TAG_NAME, ATTR_NAME, UNQUOTED, match;
var init_treeSpec = __esm({
  "../assign-gingerly/handlers/treeSpec.js"() {
    init_getValues();
    WILDCARD = "*";
    DEFAULT_WILDCARD_PATTERN = { textContent: "?." };
    textPatterns = /* @__PURE__ */ new Map();
    wildcardSpecs = /* @__PURE__ */ new WeakMap();
    keyNames = /* @__PURE__ */ new Map();
    DEFAULT_CASE = /* @__PURE__ */ Symbol("builtIns.tree default case");
    HOLE = "data-hole";
    VOID_ELEMENTS = /* @__PURE__ */ new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
    RAW_TEXT_ELEMENTS = /* @__PURE__ */ new Set(["script", "style", "textarea", "title"]);
    ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\xA0" };
    TAG_NAME = /[A-Za-z][^\s/>]*/y;
    ATTR_NAME = /[^\s/>=]+/y;
    UNQUOTED = /[^\s>]*/y;
    match = (re, text, at) => {
      re.lastIndex = at;
      return re.exec(text)?.[0];
    };
  }
});

// ../assign-gingerly/syncOps/microJoin.js
function isSegment(item) {
  return !!item && typeof item === "object" && !Array.isArray(item) && "prop" in item;
}
function toItem(raw, value2, protocols) {
  if (isSegment(value2))
    return value2.val == null ? null : value2;
  if (value2 == null)
    return null;
  if (typeof raw === "string" && isReferenceString(raw, protocols))
    return { val: value2 };
  return String(value2);
}
function flatten(raw, resolved, protocols, out, strict, state) {
  for (let i = 0; i < resolved.length; i++) {
    const value2 = resolved[i];
    const rawItem = raw[i];
    if (Array.isArray(value2)) {
      const group = [];
      if (flatten(Array.isArray(rawItem) ? rawItem : value2, value2, protocols, group, true, state)) {
        out.push(...group);
      } else {
        state.missing = true;
      }
      continue;
    }
    const item = toItem(rawItem, value2, protocols);
    if (item === null) {
      if (strict)
        return false;
      state.missing = true;
      continue;
    }
    out.push(item);
  }
  return true;
}
function mergeText(items) {
  const merged = [];
  for (const item of items) {
    if (typeof item === "string") {
      if (item === "")
        continue;
      const last = merged.length - 1;
      if (last >= 0 && typeof merged[last] === "string") {
        merged[last] += item;
        continue;
      }
    }
    merged.push(item);
  }
  return merged;
}
function planMicroJoin(args, rawArgs, protocols) {
  const raw = Array.isArray(rawArgs) ? rawArgs : args;
  const flat = [];
  const state = { missing: false };
  flatten(raw, args, protocols, flat, false, state);
  const items = mergeText(flat);
  const shapes = items.map((item) => typeof item === "string" ? void 0 : shapeOf(item));
  return { items, shapes, complete: !state.missing };
}
function shapeOf({ val, text }) {
  let shape;
  if (val instanceof Date) {
    shape = { tag: "time", attr: "datetime", attrValue: val.toISOString(), text: formatDate(val) };
  } else if (typeof val === "number") {
    shape = { tag: "data", attr: "value", attrValue: String(val), text: formatNumber(val) };
  } else if (typeof val === "boolean") {
    shape = { tag: "data", attr: "value", attrValue: String(val), text: "" };
  } else {
    shape = { tag: "span", text: String(val) };
  }
  if (text !== void 0)
    shape.text = text == null ? "" : String(text);
  return shape;
}
function sameStructure(element, items, shapes) {
  const { childNodes } = element;
  if (childNodes.length !== items.length)
    return false;
  for (let i = 0; i < items.length; i++) {
    const node = childNodes[i];
    const item = items[i];
    if (typeof item === "string") {
      if (node.nodeType !== Node.TEXT_NODE)
        return false;
    } else {
      const el = node;
      if (node.nodeType !== Node.ELEMENT_NODE || el.localName !== shapes[i].tag || el.getAttribute("itemprop") !== (item.prop ?? null)) {
        return false;
      }
    }
  }
  return true;
}
function targetElement(ctx) {
  const isElement = (x) => typeof Element !== "undefined" && x instanceof Element;
  if (isElement(ctx?.lhsTarget))
    return ctx.lhsTarget;
  if (ctx?.lhsKey === "textContent" && isElement(ctx.lhsParent))
    return ctx.lhsParent;
  return void 0;
}
function microJoin(args, _extra, ctx) {
  const element = targetElement(ctx);
  if (!element) {
    throw new Error("microJoin: the ' =&' left-hand side must resolve to an element ('?. =&') or an element's textContent");
  }
  if (!Array.isArray(args)) {
    throw new Error("microJoin: expects an array of strings, references and { prop, val, text? } segments");
  }
  const { items, shapes } = planMicroJoin(args, ctx?.rawArgs, ctx?.protocols);
  if (!element.hasAttribute("itemscope") && items.some((item) => typeof item !== "string" && item.prop !== void 0)) {
    element.setAttribute("itemscope", "");
  }
  if (sameStructure(element, items, shapes)) {
    const { childNodes } = element;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (typeof item === "string") {
        const node = childNodes[i];
        if (node.data !== item)
          node.data = item;
      } else {
        const el = childNodes[i];
        const { attr, attrValue, text } = shapes[i];
        if (attr && el.getAttribute(attr) !== attrValue)
          el.setAttribute(attr, attrValue);
        if (el.textContent !== text)
          el.textContent = text;
      }
    }
    return void 0;
  }
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (typeof item === "string") {
      fragment.append(item);
    } else {
      const { tag, attr, attrValue, text } = shapes[i];
      const el = document.createElement(tag);
      if (item.prop !== void 0)
        el.setAttribute("itemprop", item.prop);
      if (attr)
        el.setAttribute(attr, attrValue);
      if (text)
        el.textContent = text;
      fragment.append(el);
    }
  }
  element.replaceChildren(fragment);
  return void 0;
}
var numberFormat, dateFormat, formatNumber, formatDate;
var init_microJoin = __esm({
  "../assign-gingerly/syncOps/microJoin.js"() {
    init_getValues();
    formatNumber = (n) => (numberFormat ??= new Intl.NumberFormat()).format(n);
    formatDate = (d) => (dateFormat ??= new Intl.DateTimeFormat()).format(d);
  }
});

// ../assign-gingerly/utils/resolveRegistry.js
function registryOption(options) {
  const registry = options?.registry;
  if (registry == null)
    return void 0;
  if (typeof registry === "object" && checked.has(registry))
    return registry;
  const isElementRegistry = typeof CustomElementRegistry !== "undefined" && registry instanceof CustomElementRegistry;
  const prototype = typeof registry === "object" ? Object.getPrototypeOf(registry) : void 0;
  const isPlain = (prototype === Object.prototype || prototype === null) && Object.keys(registry).every((key) => KINDS.includes(key));
  if (!isElementRegistry && !isPlain) {
    throw new Error('The "registry" option takes { enhancementRegistry?, itemscopeRegistry?, featuresRegistry? } (or a CustomElementRegistry). An EnhancementRegistry goes in registry.enhancementRegistry: { registry: { enhancementRegistry: myRegistry } }.');
  }
  checked.add(registry);
  return registry;
}
function resolveRegistry(kind, options, ...targets) {
  const local = registryOption(options)?.[kind];
  if (local)
    return local;
  for (const target of targets) {
    const scoped = target?.customElementRegistry?.[kind];
    if (scoped)
      return scoped;
  }
  return typeof customElements !== "undefined" ? customElements[kind] : void 0;
}
var KINDS, checked;
var init_resolveRegistry = __esm({
  "../assign-gingerly/utils/resolveRegistry.js"() {
    "use strict";
    KINDS = ["enhancementRegistry", "itemscopeRegistry", "featuresRegistry"];
    checked = /* @__PURE__ */ new WeakSet();
  }
});

// ../assign-gingerly/SplitParser.js
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var SplitParser;
var init_SplitParser = __esm({
  "../assign-gingerly/SplitParser.js"() {
    "use strict";
    SplitParser = class {
      delimiter;
      trim;
      skipEmpty;
      dedupe;
      constructor(options) {
        const opts = options ?? {};
        const rawDelimiter = opts.delimiter;
        if (rawDelimiter === void 0) {
          this.delimiter = /\s+/;
        } else if (typeof rawDelimiter === "string") {
          this.delimiter = rawDelimiter === "" ? /(?:)/ : new RegExp(escapeRegex(rawDelimiter));
        } else {
          this.delimiter = new RegExp(rawDelimiter.pattern, rawDelimiter.flags ?? "");
        }
        this.trim = opts.trim ?? true;
        this.skipEmpty = opts.skipEmpty ?? true;
        this.dedupe = opts.dedupe ?? false;
      }
      parse(v, _context) {
        if (v === null || v === "") {
          return [];
        }
        let parts = v.split(this.delimiter);
        if (this.trim) {
          parts = parts.map((s) => s.trim());
        }
        if (this.skipEmpty) {
          parts = parts.filter((s) => s !== "");
        }
        if (this.dedupe) {
          parts = [...new Set(parts)];
        }
        return parts;
      }
    };
  }
});

// ../assign-gingerly/ScopedParserRegistry.js
var ScopedParserRegistry;
var init_ScopedParserRegistry = __esm({
  "../assign-gingerly/ScopedParserRegistry.js"() {
    "use strict";
    ScopedParserRegistry = class {
      parsers = /* @__PURE__ */ new Map();
      pendingWaits = /* @__PURE__ */ new Map();
      /**
       * @param parsers - Optional parsers to register right away, by name (same as `register` for each)
       */
      constructor(parsers) {
        if (parsers) {
          for (const name of Object.keys(parsers))
            this.register(name, parsers[name]);
        }
      }
      /**
       * Register a parser with a given name
       * Resolves any pending waiters for this parser
       * @param name - The name to register the parser under
       * @param parser - The parser function or class constructor
       */
      register(name, parser) {
        if (this.parsers.has(name)) {
          console.warn(`Parser "${name}" already registered in scoped registry, overwriting`);
        }
        this.parsers.set(name, parser);
        const waiters = this.pendingWaits.get(name);
        if (waiters) {
          waiters.forEach(({ resolve }) => resolve());
          this.pendingWaits.delete(name);
        }
      }
      /**
       * Get a parser by name
       * @param name - The name of the parser
       * @returns The parser function, class constructor, or undefined if not found
       */
      get(name) {
        return this.parsers.get(name);
      }
      /**
       * Check if a parser is registered
       * @param name - The name to check
       * @returns True if the parser exists
       */
      has(name) {
        return this.parsers.has(name);
      }
      /**
       * Wait for multiple parsers to be registered
       * @param names - Array of parser names to wait for
       * @param timeout - Timeout in milliseconds (default: 60000)
       * @returns Promise that resolves when all parsers are registered
       * @throws Error listing missing parsers if timeout expires
       */
      waitFor(names, timeout = 6e4) {
        const missing = names.filter((name) => !this.has(name));
        if (missing.length === 0) {
          return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
          let timeoutId;
          timeoutId = setTimeout(() => {
            const stillMissing = names.filter((name) => !this.has(name));
            reject(new Error(`Timeout waiting for parsers: ${stillMissing.join(", ")}`));
          }, timeout);
          let remainingCount = missing.length;
          missing.forEach((name) => {
            const waiter = {
              resolve: () => {
                remainingCount--;
                if (remainingCount === 0) {
                  if (timeoutId !== void 0) {
                    clearTimeout(timeoutId);
                  }
                  resolve();
                }
              },
              reject
            };
            if (!this.pendingWaits.has(name)) {
              this.pendingWaits.set(name, []);
            }
            this.pendingWaits.get(name).push(waiter);
          });
        });
      }
      /**
       * Get all registered parser names
       * @returns Array of parser names
       */
      getNames() {
        return Array.from(this.parsers.keys());
      }
    };
  }
});

// ../assign-gingerly/parserRegistry.js
function getParserRegistry(synthesizerElement) {
  let registry = synthesizerElement[SCOPED_REGISTRY_SYMBOL];
  if (!registry) {
    registry = new ScopedParserRegistry();
    synthesizerElement[SCOPED_REGISTRY_SYMBOL] = registry;
  }
  return registry;
}
var ParserRegistry, globalParserRegistry, SCOPED_REGISTRY_SYMBOL;
var init_parserRegistry = __esm({
  "../assign-gingerly/parserRegistry.js"() {
    "use strict";
    init_SplitParser();
    init_ScopedParserRegistry();
    ParserRegistry = class {
      parsers = /* @__PURE__ */ new Map();
      /**
       * @param parsers - Optional parsers to register right away, by name (same as `register` for each)
       * @example
       * new ParserRegistry({ csv: value => value.split(',') });
       */
      constructor(parsers) {
        if (parsers) {
          for (const name of Object.keys(parsers))
            this.register(name, parsers[name]);
        }
      }
      /**
       * Register a parser with a given name
       * @param name - The name to register the parser under
       * @param parser - The parser function or class constructor
       */
      register(name, parser) {
        if (this.parsers.has(name)) {
          console.warn(`Parser "${name}" already registered, overwriting`);
        }
        this.parsers.set(name, parser);
      }
      /**
       * Get a parser by name
       * @param name - The name of the parser
       * @returns The parser function, class constructor, or undefined if not found
       */
      get(name) {
        return this.parsers.get(name);
      }
      /**
       * Check if a parser is registered
       * @param name - The name to check
       * @returns True if the parser exists
       */
      has(name) {
        return this.parsers.has(name);
      }
      /**
       * Unregister a parser
       * @param name - The name of the parser to remove
       * @returns True if the parser was removed, false if it didn't exist
       */
      unregister(name) {
        return this.parsers.delete(name);
      }
      /**
       * Get all registered parser names
       * @returns Array of parser names
       */
      getNames() {
        return Array.from(this.parsers.keys());
      }
    };
    globalParserRegistry = new ParserRegistry();
    globalParserRegistry.register("timestamp", (v) => v ? new Date(v).getTime() : null);
    globalParserRegistry.register("date", (v) => v ? new Date(v) : null);
    globalParserRegistry.register("int", (v) => v ? parseInt(v, 10) : null);
    globalParserRegistry.register("float", (v) => v ? parseFloat(v) : null);
    globalParserRegistry.register("boolean", (v) => v !== null);
    globalParserRegistry.register("json", (v) => {
      if (v === null || v === "")
        return null;
      try {
        return JSON.parse(v);
      } catch (e) {
        throw new Error(`Failed to parse JSON: "${v}". Error: ${e}`);
      }
    });
    globalParserRegistry.register("splitter", SplitParser);
    SCOPED_REGISTRY_SYMBOL = /* @__PURE__ */ Symbol.for("assign-gingerly.scopedParserRegistry");
  }
});

// ../assign-gingerly/resolve/resolveTemplate.js
function resolveTemplate(template, patterns, resolvedCache, visitedKeys = /* @__PURE__ */ new Set()) {
  return template.replace(/\$\{(\w+)\}/g, (_match, varName) => {
    if (resolvedCache.has(varName)) {
      return resolvedCache.get(varName);
    }
    if (visitedKeys.has(varName)) {
      throw new Error(`Circular reference detected in template variable: ${varName}`);
    }
    const value2 = patterns[varName];
    if (value2 === void 0) {
      throw new Error(`Undefined template variable: ${varName}`);
    }
    if (typeof value2 === "string") {
      visitedKeys.add(varName);
      const resolved = resolveTemplate(value2, patterns, resolvedCache, visitedKeys);
      visitedKeys.delete(varName);
      resolvedCache.set(varName, resolved);
      return resolved;
    }
    return String(value2);
  });
}
var init_resolveTemplate = __esm({
  "../assign-gingerly/resolve/resolveTemplate.js"() {
    "use strict";
  }
});

// ../assign-gingerly/parseWithAttrs.js
function isAttrParserConstructor(value2) {
  return typeof value2 === "function" && !!value2.prototype && "parse" in value2.prototype;
}
function instantiateClassParser(ParserCtor, options) {
  const instance = new ParserCtor(options);
  return (attrValue, context) => instance.parse(attrValue, context);
}
function lookupNamedParser(name, synthesizerElement) {
  if (synthesizerElement) {
    const scopedRegistry = getParserRegistry(synthesizerElement);
    const scopedParser = scopedRegistry.get(name);
    if (scopedParser) {
      return scopedParser;
    }
  }
  const globalParser = globalParserRegistry.get(name);
  if (globalParser) {
    return globalParser;
  }
  throw new Error(`Parser "${name}" not found. Checked ${synthesizerElement ? "scoped registry and " : ""}global registry.
Ensure the parser is registered via:
- <script type="emc-parser" src="..." parser-name="${name}">
- registerParser(synthesizerElement, "${name}", parserFn)
- globalParserRegistry.register("${name}", parserFn)`);
}
function resolveParser(parserSpec, synthesizerElement, parserOptions) {
  if (parserSpec === void 0) {
    return void 0;
  }
  if (typeof parserSpec === "function") {
    return parserSpec;
  }
  if (parserSpec !== null && typeof parserSpec === "object" && !Array.isArray(parserSpec) && "name" in parserSpec) {
    const { name, options } = parserSpec;
    const registered = lookupNamedParser(name, synthesizerElement);
    if (isAttrParserConstructor(registered)) {
      return instantiateClassParser(registered, options);
    }
    return registered;
  }
  if (typeof parserSpec === "string") {
    const registered = lookupNamedParser(parserSpec, synthesizerElement);
    if (isAttrParserConstructor(registered)) {
      return instantiateClassParser(registered, parserOptions);
    }
    return registered;
  }
  if (Array.isArray(parserSpec) && parserSpec.length === 2) {
    const [elementName, methodName] = parserSpec;
    const Ctr = customElements.get(elementName);
    if (!Ctr) {
      throw new Error(`Cannot resolve parser [${elementName}, ${methodName}]: custom element "${elementName}" not found`);
    }
    const method = Ctr[methodName];
    if (typeof method !== "function") {
      throw new Error(`Cannot resolve parser [${elementName}, ${methodName}]: static method "${methodName}" not found on custom element "${elementName}"`);
    }
    return method.bind(Ctr);
  }
  return void 0;
}
function serializeParserOptions(options) {
  if (options === void 0 || options === null) {
    return "";
  }
  try {
    return JSON.stringify(options, (_key, value2) => {
      if (value2 instanceof RegExp) {
        return value2.toString();
      }
      return value2;
    });
  } catch (_e) {
    return String(options);
  }
}
function getCacheKey(config) {
  const instanceOfStr = typeof config.instanceOf === "function" ? config.instanceOf.name : config.instanceOf || "default";
  let parserStr;
  if (config.parser === void 0) {
    parserStr = "builtin";
  } else if (typeof config.parser === "string") {
    const optionsStr = serializeParserOptions(config.parserOptions);
    parserStr = `named:${config.parser}|options:${optionsStr}`;
  } else if (config.parser !== null && typeof config.parser === "object" && !Array.isArray(config.parser) && "name" in config.parser) {
    const ref = config.parser;
    const optionsStr = serializeParserOptions(ref.options);
    parserStr = `named:${ref.name}|options:${optionsStr}`;
  } else if (Array.isArray(config.parser)) {
    parserStr = `tuple:${config.parser[0]},${config.parser[1]}`;
  } else {
    parserStr = "custom";
  }
  return `${instanceOfStr}|${parserStr}`;
}
function parseWithCache(attrValue, config, parser, context) {
  if (config.instanceOf === "Boolean") {
    return callParser(parser, attrValue, context);
  }
  const cacheKey = getCacheKey(config);
  const valueCache = parseCache.getOrInsertComputed(cacheKey, () => /* @__PURE__ */ new Map());
  const valueCacheKey = attrValue === null ? "__NULL__" : attrValue;
  if (valueCache.has(valueCacheKey)) {
    const cachedValue = valueCache.get(valueCacheKey);
    if (config.parseCache === "cloned") {
      return structuredClone(cachedValue);
    }
    return cachedValue;
  }
  const parsedValue = callParser(parser, attrValue, context);
  valueCache.set(valueCacheKey, parsedValue);
  if (config.parseCache === "cloned") {
    return structuredClone(parsedValue);
  }
  return parsedValue;
}
function callParser(parser, attrValue, context) {
  if (parser.length >= 2) {
    return parser(attrValue, context);
  }
  return parser(attrValue);
}
function hasDashOrNonASCII(str) {
  if (str.includes("-"))
    return true;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127)
      return true;
  }
  return false;
}
function getAttributeValue(element, attrName, allowUnprefixed) {
  if (allowUnprefixed === true) {
    return element.getAttribute(attrName);
  }
  const { localName } = element;
  const isCustomElement = localName.includes("-");
  const isSVGElement = typeof SVGElement !== "undefined" && element instanceof SVGElement;
  if (isCustomElement || isSVGElement) {
    const enhValue2 = element.getAttribute(`enh-${attrName}`);
    if (enhValue2 !== null)
      return enhValue2;
    if (allowUnprefixed) {
      const pattern = typeof allowUnprefixed === "string" ? new RegExp(allowUnprefixed) : allowUnprefixed;
      if (pattern.test(localName)) {
        return element.getAttribute(attrName);
      }
    }
    return null;
  }
  const enhValue = element.getAttribute(`enh-${attrName}`);
  if (enhValue !== null)
    return enhValue;
  return element.getAttribute(attrName);
}
function getDefaultParser(instanceOf) {
  if (!instanceOf) {
    return (v) => v;
  }
  const typeStr = typeof instanceOf === "string" ? instanceOf : instanceOf.name;
  switch (typeStr) {
    case "Object":
      return (v) => {
        if (v === null || v === "")
          return null;
        try {
          return JSON.parse(v);
        } catch (e) {
          throw new Error(`Failed to parse JSON: "${v}". Error: ${e}`);
        }
      };
    case "Array":
      return (v) => {
        if (v === null || v === "")
          return null;
        try {
          return JSON.parse(v);
        } catch (e) {
          throw new Error(`Failed to parse JSON array: "${v}". Error: ${e}`);
        }
      };
    case "Number":
      return (v) => {
        if (v === null || v === "")
          return null;
        const num = Number(v);
        if (isNaN(num)) {
          throw new Error(`Failed to parse number: "${v}"`);
        }
        return num;
      };
    case "Boolean":
      return (v) => v !== null;
    // Presence check
    case "String":
    default:
      return (v) => v;
  }
}
function parseWithAttrs(element, attrPatterns, allowUnprefixed, spawnContext) {
  const synthesizerElement = spawnContext?.synthesizerElement;
  const isCustomElementMode = allowUnprefixed === true;
  if ("base" in attrPatterns && !isCustomElementMode) {
    const baseValue = attrPatterns.base;
    if (!hasDashOrNonASCII(baseValue)) {
      throw new Error(`Invalid base attribute "${baseValue}": must contain a dash (-) or non-ASCII character. Examples: "data-config", "my-attr", "\u{1F3A8}-theme"`);
    }
  }
  const result = {};
  const resolvedCache = /* @__PURE__ */ new Map();
  const resolvedAttrs = /* @__PURE__ */ new Map();
  for (const key in attrPatterns) {
    if (key === "base" || key.startsWith("_")) {
      continue;
    }
    const value2 = attrPatterns[key];
    if (typeof value2 === "string") {
      const resolvedAttrName = resolveTemplate(value2, attrPatterns, resolvedCache);
      const configKey = `_${key}`;
      let config;
      if (configKey in attrPatterns) {
        config = attrPatterns[configKey];
      } else {
        config = {
          mapsTo: key,
          instanceOf: "String"
        };
      }
      resolvedAttrs.set(key, { attrName: resolvedAttrName, config });
    }
  }
  if ("base" in attrPatterns) {
    const baseAttrName = attrPatterns.base;
    let baseConfig;
    if ("_base" in attrPatterns) {
      baseConfig = attrPatterns._base;
    } else {
      baseConfig = {
        mapsTo: ".",
        instanceOf: "Object"
      };
    }
    resolvedAttrs.set("base", { attrName: baseAttrName, config: baseConfig });
  }
  for (const [key, { attrName, config }] of resolvedAttrs) {
    if (isCustomElementMode) {
      const mapsTo2 = config.mapsTo ?? (key === "base" ? "." : key);
      if (mapsTo2 !== "." && element[mapsTo2] !== void 0) {
        continue;
      }
    }
    const attrValue = getAttributeValue(element, attrName, allowUnprefixed);
    const parserContext = {
      attrConfig: config,
      spawnContext,
      element,
      attrName
    };
    if (attrValue === null) {
      if (config.valIfNull !== void 0) {
        const mapsTo2 = config.mapsTo ?? (key === "base" ? "." : key);
        if (mapsTo2 === ".") {
          if (typeof config.valIfNull === "object" && config.valIfNull !== null) {
            Object.assign(result, config.valIfNull);
          }
        } else {
          result[mapsTo2] = config.valIfNull;
        }
      } else if (config.instanceOf !== "Boolean") {
        continue;
      } else {
        const parser2 = resolveParser(config.parser, synthesizerElement, config.parserOptions) || getDefaultParser(config.instanceOf);
        const parsedValue2 = callParser(parser2, attrValue, parserContext);
        const mapsTo2 = config.mapsTo ?? (key === "base" ? "." : key);
        result[mapsTo2] = parsedValue2;
      }
      continue;
    }
    const parser = resolveParser(config.parser, synthesizerElement, config.parserOptions) || getDefaultParser(config.instanceOf);
    const parsedValue = config.parseCache ? parseWithCache(attrValue, config, parser, parserContext) : callParser(parser, attrValue, parserContext);
    const mapsTo = config.mapsTo ?? (key === "base" ? "." : key);
    if (mapsTo === ".") {
      if (typeof parsedValue === "object" && parsedValue !== null) {
        Object.assign(result, parsedValue);
      }
    } else {
      result[mapsTo] = parsedValue;
    }
  }
  return result;
}
var parseCache;
var init_parseWithAttrs = __esm({
  "../assign-gingerly/parseWithAttrs.js"() {
    "use strict";
    init_parserRegistry();
    init_resolveTemplate();
    parseCache = /* @__PURE__ */ new Map();
  }
});

// ../assign-gingerly/utils/isAsyncSpawn.js
function isAsyncSpawn(fn) {
  if (typeof fn !== "function")
    return false;
  if (fn.constructor.name === "AsyncFunction")
    return true;
  if (fn.prototype === void 0)
    return true;
  return false;
}
var init_isAsyncSpawn = __esm({
  "../assign-gingerly/utils/isAsyncSpawn.js"() {
    "use strict";
  }
});

// ../assign-gingerly/assignPermissions/isAllowedUrl.js
function isAllowedUrl(value2, base = document.baseURI) {
  if (typeof document === "undefined" || typeof location === "undefined")
    return false;
  if (typeof value2 !== "string" || value2 === "")
    return false;
  try {
    return new URL(value2, base).origin === location.origin;
  } catch {
    return false;
  }
}
var init_isAllowedUrl = __esm({
  "../assign-gingerly/assignPermissions/isAllowedUrl.js"() {
    "use strict";
  }
});

// ../assign-gingerly/assignPermissions/isAllowedImportPath.js
function isAllowedImportPath(value2) {
  if (typeof document === "undefined" || typeof location === "undefined")
    return false;
  if (!value2 || !(value2.startsWith("./") || value2.startsWith("../") || value2.startsWith("/"))) {
    return isImportMapSpecifier(value2);
  }
  return isAllowedUrl(value2);
}
function isImportMapSpecifier(value2) {
  const importMaps = document.querySelectorAll('script[type="importmap"]');
  for (const importMap of importMaps) {
    try {
      const parsed = JSON.parse(importMap.textContent ?? "");
      if (!isImportMap(parsed))
        continue;
      for (const key of Object.keys(parsed.imports)) {
        if (key.endsWith("/") ? value2.startsWith(key) : value2 === key)
          return true;
      }
    } catch {
    }
  }
  return false;
}
function isImportMap(value2) {
  if (!value2 || typeof value2 !== "object" || !("imports" in value2))
    return false;
  const { imports } = value2;
  return !!imports && typeof imports === "object" && !Array.isArray(imports);
}
var init_isAllowedImportPath = __esm({
  "../assign-gingerly/assignPermissions/isAllowedImportPath.js"() {
    "use strict";
    init_isAllowedUrl();
  }
});

// ../assign-gingerly/utils/findClassPrototypeInPath.js
function isClassWithPrototype(value2) {
  return typeof value2 === "function" && value2.prototype !== void 0;
}
async function findClassPrototypeInPath(path, criteria) {
  if (!isAllowedImportPath(path)) {
    throw new ImportNotAllowedError(path);
  }
  const module = await import(path);
  const candidates = [
    module.default,
    ...Object.values(module).filter((exported) => exported !== module.default)
  ];
  for (const exported of candidates) {
    if (!isClassWithPrototype(exported))
      continue;
    if (criteria && !criteria(exported))
      continue;
    return exported;
  }
  throw new NoMatchingExportError(path);
}
var ImportNotAllowedError, NoMatchingExportError;
var init_findClassPrototypeInPath = __esm({
  "../assign-gingerly/utils/findClassPrototypeInPath.js"() {
    "use strict";
    init_isAllowedImportPath();
    ImportNotAllowedError = class extends Error {
      path;
      constructor(path) {
        super(`Import path "${path}" is not allowed.`);
        this.path = path;
        this.name = "ImportNotAllowedError";
        console.error(`ImportNotAllowedError: ${path}`);
      }
    };
    NoMatchingExportError = class extends Error {
      path;
      constructor(path) {
        super(`Module "${path}" does not export a matching class with a prototype.`);
        this.path = path;
        this.name = "NoMatchingExportError";
        console.error(`NoMatchingExportError: ${path}`);
      }
    };
  }
});

// ../assign-gingerly/assignFeatures.js
var assignFeatures_exports = {};
__export(assignFeatures_exports, {
  FeaturesRegistry: () => FeaturesRegistry,
  PropertyBag: () => PropertyBag,
  assignFeatures: () => assignFeatures,
  captureFeatureInitVals: () => captureFeatureInitVals,
  getFeatureInfoSuggestions: () => getFeatureInfoSuggestions,
  resolvedSpawnCache: () => resolvedSpawnCache,
  suggestFeatureInfo: () => suggestFeatureInfo
});
function getOrCreateClassCache(ctr) {
  let classCache = resolvedSpawnCache.get(ctr);
  if (!classCache) {
    classCache = /* @__PURE__ */ new Map();
    resolvedSpawnCache.set(ctr, classCache);
  }
  return classCache;
}
async function resolveSpawn(spawnish) {
  if (!spawnish)
    return void 0;
  if (typeof spawnish === "string") {
    return await findClassPrototypeInPath(spawnish);
  }
  if (isAsyncSpawn(spawnish)) {
    return await spawnish();
  }
  return spawnish;
}
function isAsyncResolution(spawnish) {
  if (typeof spawnish === "string")
    return true;
  if (isAsyncSpawn(spawnish))
    return true;
  return false;
}
async function resolveAndCacheSpawns(ctr, features, supportedFeatures) {
  const asyncResolutions = [];
  for (const key of Object.keys(features)) {
    const classCache = getOrCreateClassCache(ctr);
    if (classCache.has(key))
      continue;
    const featureConfig = features[key];
    let spawnish = featureConfig.spawn;
    if (spawnish === void 0) {
      const optIn = supportedFeatures[key];
      spawnish = optIn?.fallbackSpawn;
    }
    if (!spawnish) {
      classCache.set(key, void 0);
      continue;
    }
    if (isAsyncResolution(spawnish)) {
      asyncResolutions.push((async () => {
        const resolved = await resolveSpawn(spawnish);
        classCache.set(key, resolved);
      })());
    } else {
      classCache.set(key, spawnish);
    }
  }
  if (asyncResolutions.length > 0) {
    await Promise.all(asyncResolutions);
  }
}
function installFeatureGetter(ctr, key, featuresRegistry) {
  Object.defineProperty(ctr.prototype, key, {
    get: function() {
      let storage = featureStorage.get(this);
      if (!storage) {
        storage = /* @__PURE__ */ new Map();
        featureStorage.set(this, storage);
      }
      const stored = storage.get(key);
      if (stored !== void 0 && !(stored && typeof stored === "object" && RAW_INIT_VALS in stored)) {
        return stored;
      }
      let initVals = void 0;
      if (stored && typeof stored === "object" && RAW_INIT_VALS in stored) {
        initVals = stored[RAW_INIT_VALS];
        storage.delete(key);
      } else if (Object.hasOwn(this, key)) {
        initVals = this[key];
        delete this[key];
      }
      const registry = this.customElementRegistry || customElements;
      const fr = registry.featuresRegistry;
      if (!fr || !fr.has(ctr)) {
        throw new Error(`assignFeatures: featuresRegistry missing entry for constructor`);
      }
      const features = fr.get(ctr);
      const injection = features.get(key);
      if (!injection) {
        throw new Error(`assignFeatures: no injection found for feature "${key}"`);
      }
      const spawns = resolvedSpawnCache.get(ctr);
      const resolvedSpawn = spawns?.get(key);
      if (!resolvedSpawn) {
        throw new Error(`assignFeatures: no spawn implementation found for feature "${key}"`);
      }
      const supportedFeatures = ctr.supportedFeatures;
      const optIn = supportedFeatures?.[key];
      if (!optIn) {
        throw new Error(`assignFeatures: "${key}" not in static supportedFeatures`);
      }
      const shared = optIn.getSharedContext?.(this);
      const ctx = {
        key,
        optIn,
        injection,
        featuresRegistry: fr,
        shared
      };
      let attrInitVals = void 0;
      if (injection.withAttrs && this instanceof Element) {
        try {
          attrInitVals = parseWithAttrs(
            this,
            injection.withAttrs,
            true
            // always unprefixed for features
          );
        } catch (e) {
          console.error("Error parsing feature attributes:", e);
          throw e;
        }
      }
      if (attrInitVals) {
        initVals = initVals ? { ...attrInitVals, ...initVals } : attrInitVals;
      }
      const instance = new resolvedSpawn(this, ctx, initVals);
      if (optIn.validateShape) {
        if (!optIn.validateShape(instance)) {
          throw new Error(`assignFeatures: spawned instance for "${key}" failed shape validation`);
        }
      }
      storage.set(key, instance);
      return instance;
    },
    enumerable: true,
    configurable: false
  });
}
function installCallbackForwarding(ctr, key, callbacks) {
  let ctrCallbacks = callbackRegistry.get(ctr);
  if (!ctrCallbacks) {
    ctrCallbacks = /* @__PURE__ */ new Map();
    callbackRegistry.set(ctr, ctrCallbacks);
  }
  for (const callbackName of callbacks) {
    if (!VALID_CALLBACKS.has(callbackName)) {
      throw new Error(`assignFeatures: invalid callbackForwarding "${callbackName}" for feature "${key}". Valid values: ${[...VALID_CALLBACKS].join(", ")}`);
    }
    let featureKeys = ctrCallbacks.get(callbackName);
    if (!featureKeys) {
      featureKeys = /* @__PURE__ */ new Set();
      ctrCallbacks.set(callbackName, featureKeys);
      const original = ctr.prototype[callbackName];
      Object.defineProperty(ctr.prototype, callbackName, {
        value: function(...args) {
          if (original)
            original.apply(this, args);
          const keys = callbackRegistry.get(ctr)?.get(callbackName);
          if (keys) {
            for (const featureKey of keys) {
              const feature = this[featureKey];
              if (feature && typeof feature === "object" && typeof feature[callbackName] === "function") {
                feature[callbackName](...args);
              }
            }
          }
        },
        writable: true,
        enumerable: false,
        configurable: true
      });
    }
    featureKeys.add(key);
  }
}
async function installOneFeature(ctr, key, features, supportedFeatures, featuresRegistry) {
  if (!(key in supportedFeatures)) {
    throw new Error(`assignFeatures: "${key}" is not declared in ${ctr.name || "constructor"}.supportedFeatures`);
  }
  const existingDescriptor = Object.getOwnPropertyDescriptor(ctr.prototype, key);
  if (existingDescriptor) {
    throw new Error(`assignFeatures: "${key}" already exists on ${ctr.name || "constructor"}.prototype`);
  }
  if (featuresRegistry.hasKey(ctr, key)) {
    throw new Error(`assignFeatures: "${key}" has already been assigned for ${ctr.name || "constructor"}`);
  }
  featuresRegistry.set(ctr, key, features[key]);
  installFeatureGetter(ctr, key, featuresRegistry);
  const featureConfig = features[key];
  const optIn = supportedFeatures[key];
  const authorCallbacks = optIn.callbackForwarding || [];
  const consumerCallbacks = featureConfig.callbackForwarding || [];
  const allCallbacks = [.../* @__PURE__ */ new Set([...authorCallbacks, ...consumerCallbacks])];
  if (allCallbacks.length > 0) {
    installCallbackForwarding(ctr, key, allCallbacks);
  }
  const classCache = getOrCreateClassCache(ctr);
  const resolvedSpawn = classCache.get(key);
  if (resolvedSpawn && !isAsyncSpawn(resolvedSpawn) && Object.hasOwn(resolvedSpawn, "onAssigned") && typeof resolvedSpawn.onAssigned === "function") {
    await resolvedSpawn.onAssigned(ctr, featureConfig, key);
  }
}
async function installAllFeatures(ctr, features, supportedFeatures, featuresRegistry) {
  for (const key of Object.keys(features)) {
    await installOneFeature(ctr, key, features, supportedFeatures, featuresRegistry);
  }
}
async function assignFeatures(ctr, features, featuresRegistry) {
  const supportedFeatures = ctr.supportedFeatures;
  if (!supportedFeatures) {
    throw new Error(`assignFeatures: ${ctr.name || "constructor"} does not define static supportedFeatures`);
  }
  await resolveAndCacheSpawns(ctr, features, supportedFeatures);
  await installAllFeatures(ctr, features, supportedFeatures, featuresRegistry);
}
function captureFeatureInitVals(instance) {
  const ctr = instance.constructor;
  const supportedFeatures = ctr.supportedFeatures;
  if (!supportedFeatures)
    return;
  for (const key of Object.keys(supportedFeatures)) {
    if (Object.hasOwn(instance, key)) {
      const value2 = instance[key];
      delete instance[key];
      let storage = featureStorage.get(instance);
      if (!storage) {
        storage = /* @__PURE__ */ new Map();
        featureStorage.set(instance, storage);
      }
      storage.set(key, { [RAW_INIT_VALS]: value2 });
    }
  }
}
function suggestFeatureInfo(fromFeatureCtr, toFeatureSymbol, featureInfo, targetClass) {
  let symbolMap = featureInfoSuggestions.get(toFeatureSymbol);
  if (!symbolMap) {
    symbolMap = /* @__PURE__ */ new Map();
    featureInfoSuggestions.set(toFeatureSymbol, symbolMap);
  }
  let suggestions = symbolMap.get(targetClass);
  if (!suggestions) {
    suggestions = [];
    symbolMap.set(targetClass, suggestions);
  }
  suggestions.push({
    from: fromFeatureCtr,
    ...featureInfo
  });
}
function getFeatureInfoSuggestions(toFeatureSymbol, targetClass) {
  const symbolMap = featureInfoSuggestions.get(toFeatureSymbol);
  if (!symbolMap)
    return [];
  return symbolMap.get(targetClass) || [];
}
var featureStorage, FeaturesRegistry, RAW_INIT_VALS, resolvedSpawnCache, VALID_CALLBACKS, callbackRegistry, featureInfoSuggestions, PropertyBag;
var init_assignFeatures = __esm({
  "../assign-gingerly/assignFeatures.js"() {
    "use strict";
    init_parseWithAttrs();
    init_isAsyncSpawn();
    init_findClassPrototypeInPath();
    featureStorage = /* @__PURE__ */ new WeakMap();
    FeaturesRegistry = class {
      #registry = /* @__PURE__ */ new Map();
      has(ctr) {
        return this.#registry.has(ctr);
      }
      get(ctr) {
        return this.#registry.get(ctr);
      }
      set(ctr, key, injection) {
        let features = this.#registry.get(ctr);
        if (!features) {
          features = /* @__PURE__ */ new Map();
          this.#registry.set(ctr, features);
        }
        features.set(key, injection);
      }
      hasKey(ctr, key) {
        const features = this.#registry.get(ctr);
        return features ? features.has(key) : false;
      }
    };
    RAW_INIT_VALS = /* @__PURE__ */ Symbol("rawInitVals");
    resolvedSpawnCache = /* @__PURE__ */ new WeakMap();
    VALID_CALLBACKS = /* @__PURE__ */ new Set([
      "connectedCallback",
      "disconnectedCallback",
      "attributeChangedCallback",
      "adoptedCallback",
      "formDisabledCallback",
      "formResetCallback",
      "formStateRestoreCallback"
    ]);
    callbackRegistry = /* @__PURE__ */ new Map();
    featureInfoSuggestions = /* @__PURE__ */ new Map();
    PropertyBag = class _PropertyBag {
      /** Registry reference carried from the host element */
      customElementRegistry;
      constructor(hostElement, ctx, initVals) {
        if (this.constructor === _PropertyBag) {
          throw new Error("PropertyBag must be subclassed. Define static supportedFeatures on your subclass.");
        }
        this.customElementRegistry = hostElement.customElementRegistry || (typeof customElements !== "undefined" ? customElements : void 0);
        if (initVals && typeof initVals === "object") {
          Object.assign(this, initVals);
        }
      }
    };
    if (typeof CustomElementRegistry !== "undefined") {
      Object.defineProperty(CustomElementRegistry.prototype, "featuresRegistry", {
        get: function() {
          const registry = new FeaturesRegistry();
          Object.defineProperty(this, "featuresRegistry", {
            value: registry,
            writable: true,
            enumerable: false,
            configurable: true
          });
          return registry;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(CustomElementRegistry.prototype, "assignFeatures", {
        value: function(ctr, features) {
          return assignFeatures(ctr, features, this.featuresRegistry);
        },
        writable: true,
        enumerable: false,
        configurable: true
      });
    }
  }
});

// ../assign-gingerly/handlers/arr.js
function arr(inp) {
  return inp === void 0 ? [] : Array.isArray(inp) ? inp : [inp];
}
var init_arr = __esm({
  "../assign-gingerly/handlers/arr.js"() {
    "use strict";
  }
});

// ../assign-gingerly/handlers/nudge.js
var nudge_exports = {};
__export(nudge_exports, {
  nudge: () => nudge
});
function nudge(el, attr = "disabled") {
  const attrs = arr(attr);
  for (const attr2 of attrs) {
    const da = el.getAttribute(attr2);
    if (da !== null) {
      if (da.length === 0 || da === "1") {
        el.removeAttribute(attr2);
        if (attr2 === "disabled")
          el.disabled = false;
      } else {
        el.setAttribute(attr2, (parseInt(da) - 1).toString());
      }
    }
  }
}
var init_nudge = __esm({
  "../assign-gingerly/handlers/nudge.js"() {
    "use strict";
    init_arr();
  }
});

// ../assign-gingerly/handlers/addEventListener.js
var addEventListener_exports = {};
__export(addEventListener_exports, {
  attachEventListener: () => attachEventListener
});
function extractShorthand(config) {
  const shorthand = {};
  let hasAny = false;
  for (const key of Object.keys(config)) {
    if (!RESERVED_KEYS.has(key)) {
      shorthand[key] = config[key];
      hasAny = true;
    }
  }
  return hasAny ? shorthand : null;
}
function processVector(vector, source, target, host, lhs, inheritedOptions, useAssignFrom, permissionProcessor) {
  const destinations = [
    { key: "toTarget", dest: target },
    { key: "toHost", dest: host },
    { key: "toLHS", dest: lhs }
  ];
  for (const { key, dest } of destinations) {
    const pattern = vector[key];
    if (!pattern || Object.keys(pattern).length === 0)
      continue;
    if (useAssignFrom && source != null) {
      Promise.resolve().then(() => (init_assignFrom(), assignFrom_exports)).then(({ assignFrom: assignFrom2 }) => {
        assignFrom2(dest, pattern, { ...inheritedOptions, ...vector.withOptions, from: source }, permissionProcessor);
      });
    } else {
      assignGingerly_default(dest, pattern, inheritedOptions, permissionProcessor);
    }
  }
  const shorthand = extractShorthand(vector);
  if (shorthand) {
    if (useAssignFrom && source != null) {
      Promise.resolve().then(() => (init_assignFrom(), assignFrom_exports)).then(({ assignFrom: assignFrom2 }) => {
        assignFrom2(host, shorthand, { ...inheritedOptions, ...vector.withOptions, from: source }, permissionProcessor);
      });
    } else {
      assignGingerly_default(host, shorthand, inheritedOptions, permissionProcessor);
    }
  }
}
function attachEventListener(lhs, config, target, host, inheritedOptions, permissionProcessor) {
  const { on: eventName, call, get: getConfig, fromLHS, fromHost, fromTarget, fromEvent, dispatch } = config;
  const { abortController, key, nudge: nudge2, options: listenerOptions, stopPropagation, preventDefault, dispatch: getDispatch } = getConfig ?? {};
  let controller;
  if (key) {
    let elMap = keyMap.get(lhs);
    if (!elMap) {
      elMap = /* @__PURE__ */ new Map();
      keyMap.set(lhs, elMap);
    }
    const prev = elMap.get(key);
    if (prev)
      prev.abort();
    controller = new AbortController();
    elMap.set(key, controller);
  } else if (abortController instanceof AbortController) {
    controller = abortController;
  } else {
    controller = new AbortController();
  }
  lhs.addEventListener(eventName, (event) => {
    if (stopPropagation)
      event.stopPropagation();
    if (preventDefault)
      event.preventDefault();
    if (call && !permissionProcessor?.checkRestrictedMethod(call)) {
      const method = host?.[call];
      if (typeof method !== "function") {
        throw new Error(`addEventListener: call "${call}" is not a method on the host`);
      }
      method.call(host, event);
    }
    processVector(config, null, target, host, lhs, inheritedOptions, false, permissionProcessor);
    if (fromLHS) {
      processVector(fromLHS, lhs, target, host, lhs, inheritedOptions, true, permissionProcessor);
    }
    if (fromHost) {
      processVector(fromHost, host, target, host, lhs, inheritedOptions, true, permissionProcessor);
    }
    if (fromTarget) {
      processVector(fromTarget, target, target, host, lhs, inheritedOptions, true, permissionProcessor);
    }
    if (fromEvent) {
      processVector(fromEvent, event, target, host, lhs, inheritedOptions, true, permissionProcessor);
    }
    const dispatchConfig = dispatch || getDispatch;
    if (dispatchConfig && dispatchConfig.type) {
      const EventCtr = typeof dispatchConfig.eventCtr === "function" ? dispatchConfig.eventCtr : CustomEvent;
      const evt = new EventCtr(dispatchConfig.type, {
        detail: dispatchConfig.detail,
        bubbles: dispatchConfig.bubbles ?? true,
        cancelable: dispatchConfig.cancelable ?? false,
        composed: dispatchConfig.composed ?? true
      });
      lhs.dispatchEvent(evt);
    }
  }, { signal: controller.signal, ...listenerOptions });
  if (nudge2) {
    Promise.resolve().then(() => (init_nudge(), nudge_exports)).then(({ nudge: nudgeFn }) => {
      nudgeFn(lhs);
    });
  }
}
var keyMap, RESERVED_KEYS;
var init_addEventListener = __esm({
  "../assign-gingerly/handlers/addEventListener.js"() {
    "use strict";
    init_assignGingerly();
    keyMap = /* @__PURE__ */ new WeakMap();
    RESERVED_KEYS = /* @__PURE__ */ new Set([
      "on",
      "call",
      "get",
      "fromLHS",
      "fromHost",
      "fromEvent",
      "fromTarget",
      "toTarget",
      "toHost",
      "toLHS",
      "withOptions",
      "toTargetOptions",
      "toHostOptions",
      "toLHSOptions",
      "dispatch",
      "nudge"
    ]);
  }
});

// ../assign-gingerly/utils/waitForEvent.js
var waitForEvent_exports = {};
__export(waitForEvent_exports, {
  waitForEvent: () => waitForEvent
});
function waitForEvent(et, eventName, failureEventName, timeout) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    const cleanup = () => {
      if (timeoutId !== void 0) {
        clearTimeout(timeoutId);
      }
    };
    et.addEventListener(eventName, (e) => {
      cleanup();
      resolve(e);
    }, { once: true });
    if (failureEventName !== void 0) {
      et.addEventListener(failureEventName, (e) => {
        cleanup();
        reject(e);
      }, { once: true });
    }
    if (timeout !== void 0 && timeout > 0) {
      timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for event '${eventName}' after ${timeout}ms`));
      }, timeout);
    }
  });
}
var init_waitForEvent = __esm({
  "../assign-gingerly/utils/waitForEvent.js"() {
    "use strict";
  }
});

// ../assign-gingerly/handleIshProperty.js
var handleIshProperty_exports = {};
__export(handleIshProperty_exports, {
  defineIshCore: () => defineIshCore,
  handleIshProperty: () => handleIshProperty,
  setScopeBinder: () => setScopeBinder
});
function setScopeBinder(element, binder) {
  scopeBinders.set(element, binder);
}
async function handleIshProperty(element, value2, options, assignGingerlyFn) {
  const itemscopeValue = element.getAttribute("itemscope");
  if (typeof itemscopeValue !== "string" || itemscopeValue.length === 0) {
    throw new Error("Element must have itemscope attribute set to a non-empty string value");
  }
  if (!("ish" in element)) {
    await defineIshProperty(element, itemscopeValue, options, assignGingerlyFn);
  }
  const ishDescriptor = Object.getOwnPropertyDescriptor(element, "ish");
  if (ishDescriptor && ishDescriptor.set) {
    ishDescriptor.set.call(element, value2);
  }
}
async function defineIshProperty(element, managerName, options, assignGingerlyFn) {
  const registry = resolveRegistry("itemscopeRegistry", options, element);
  if (!registry) {
    throw new Error("ItemscopeRegistry not available");
  }
  let config = registry.get(managerName);
  if (!config) {
    const { waitForEvent: waitForEvent2 } = await Promise.resolve().then(() => (init_waitForEvent(), waitForEvent_exports));
    await waitForEvent2(registry, managerName);
    config = registry.get(managerName);
    if (!config) {
      throw new Error(`Manager "${managerName}" not found after registration event`);
    }
  }
  if ("ish" in element)
    return;
  defineIshCore(element, config, options, assignGingerlyFn);
}
function reportAsync(err) {
  console.error("Error in onAssigned:", err);
  setTimeout(() => {
    throw err;
  }, 0);
}
function isThenable(value2) {
  return value2 != null && typeof value2.then === "function";
}
function defineIshCore(element, config, options, assignGingerlyFn, extension) {
  const { manager } = config;
  const { onAssigned } = manager;
  const rebindScope = () => scopeBinders.get(element)?.();
  const { ctx = { rebind: rebindScope }, onSettled = rebindScope } = extension ?? {};
  let managerInstance = null;
  const valueQueue = [];
  let pending = false;
  function apply(value2) {
    if (managerInstance === null) {
      if (onAssigned) {
        managerInstance = new manager(element, void 0, ctx);
        return onAssigned.call(manager, managerInstance, value2, { element, initial: true, options, ...ctx });
      }
      managerInstance = new manager(element, Object.assign({}, value2), ctx);
      return;
    }
    if (onAssigned) {
      return onAssigned.call(manager, managerInstance, value2, { element, initial: false, options, ...ctx });
    }
    if (value2 == null)
      return;
    assignGingerlyFn(managerInstance, value2, options);
  }
  async function drain(inFlight) {
    let current = inFlight;
    while (current) {
      try {
        await current;
      } catch (err) {
        reportAsync(err);
      }
      current = void 0;
      while (!current && valueQueue.length > 0) {
        try {
          const result = apply(valueQueue.shift());
          if (isThenable(result))
            current = result;
        } catch (err) {
          reportAsync(err);
        }
      }
    }
    pending = false;
    if (onSettled) {
      try {
        onSettled();
      } catch (err) {
        reportAsync(err);
      }
    }
  }
  Object.defineProperty(element, "ish", {
    get() {
      return managerInstance;
    },
    set(newValue) {
      if (managerInstance !== null && newValue === managerInstance) {
        return;
      }
      if (pending) {
        valueQueue.push(newValue);
        return;
      }
      const result = apply(newValue);
      if (isThenable(result)) {
        pending = true;
        drain(result);
      }
    },
    enumerable: true,
    configurable: true
  });
}
var scopeBinders;
var init_handleIshProperty = __esm({
  "../assign-gingerly/handleIshProperty.js"() {
    "use strict";
    init_resolveRegistry();
    scopeBinders = /* @__PURE__ */ new WeakMap();
  }
});

// ../assign-gingerly/eachTime.js
var eachTime_exports = {};
__export(eachTime_exports, {
  handleEachTime: () => handleEachTime
});
function isEventTarget(value2) {
  return value2 != null && typeof value2.addEventListener === "function";
}
async function handleEachTime(target, pathParts, forEachIndex, value2, withMethods, aliasMap, options, permissionProcessor) {
  if (!options?.signal) {
    throw new Error("@eachTime requires an AbortSignal in options.signal for cleanup");
  }
  const pathToEventSource = pathParts.slice(0, forEachIndex);
  const pathAfterForEach = pathParts.slice(forEachIndex + 1);
  let eventSource = target;
  if (pathToEventSource.length > 0) {
    const { evaluatePathWithMethods: evaluatePathWithMethods2 } = await Promise.resolve().then(() => (init_assignGingerly(), assignGingerly_exports));
    if (withMethods && withMethods.size > 0) {
      const result = evaluatePathWithMethods2(target, pathToEventSource, value2, withMethods, permissionProcessor);
      eventSource = result.target;
    } else {
      for (const part of pathToEventSource) {
        eventSource = eventSource[part];
      }
    }
  }
  if (!isEventTarget(eventSource)) {
    throw new Error("@eachTime requires an EventTarget (e.g., IMountObserver)");
  }
  const handler = (event) => {
    const mountedElement = event.mountedElement;
    if (!mountedElement)
      return;
    (async () => {
      try {
        const { evaluatePathWithMethods: evaluatePathWithMethods2, assignGingerly: assignGingerly2, isReadonlyProperty: isReadonlyProperty2 } = await Promise.resolve().then(() => (init_assignGingerly(), assignGingerly_exports));
        if (pathAfterForEach.length > 0) {
          const result = evaluatePathWithMethods2(mountedElement, pathAfterForEach, value2, withMethods || /* @__PURE__ */ new Set(), permissionProcessor);
          if (result.isMethod) {
            const method = result.target[result.lastKey];
            if (typeof method === "function") {
              if (result.isZeroArg) {
                method.call(result.target);
              } else if (Array.isArray(value2)) {
                method.apply(result.target, value2);
              } else {
                method.call(result.target, value2);
              }
            }
          } else {
            const lastKey = result.lastKey;
            const parent = result.target;
            if (permissionProcessor?.redirectRestrictedProp(parent, lastKey, value2)) {
            } else if (typeof value2 === "object" && value2 !== null && !Array.isArray(value2)) {
              if (lastKey in parent && isReadonlyProperty2(parent, lastKey)) {
                const currentValue = parent[lastKey];
                if (typeof currentValue !== "object" || currentValue === null) {
                  throw new Error(`Cannot merge object into readonly primitive property '${String(lastKey)}'`);
                }
                assignGingerly2(currentValue, value2, options, permissionProcessor);
              } else {
                parent[lastKey] = value2;
              }
            } else {
              parent[lastKey] = value2;
            }
          }
        }
      } catch (error) {
        console.error("Error applying @eachTime to mounted element:", error);
      }
    })();
  };
  eventSource.addEventListener("mount", handler, { signal: options.signal });
}
var init_eachTime = __esm({
  "../assign-gingerly/eachTime.js"() {
    "use strict";
  }
});

// ../assign-gingerly/evaluatePathWithAsyncMethods.js
var evaluatePathWithAsyncMethods_exports = {};
__export(evaluatePathWithAsyncMethods_exports, {
  evaluatePathWithAsyncMethods: () => evaluatePathWithAsyncMethods
});
function isAllowedAsyncMethod(methodName, withAsyncMethods, permissionProcessor) {
  return withAsyncMethods.has(methodName) && !permissionProcessor?.checkRestrictedMethod(methodName);
}
async function evaluatePathWithAsyncMethods(target, pathParts, value2, withMethods, withAsyncMethods, permissionProcessor) {
  let current = target;
  let i = 0;
  while (i < pathParts.length - 1) {
    const part = pathParts[i];
    const nextPart = pathParts[i + 1];
    const isZeroArgSync = part.endsWith("|") && isAllowedMethod2(part.slice(0, -1), withMethods, permissionProcessor);
    const isZeroArgAsync = part.endsWith("|") && isAllowedAsyncMethod(part.slice(0, -1), withAsyncMethods, permissionProcessor);
    const baseName = isZeroArgSync || isZeroArgAsync ? part.slice(0, -1) : part;
    const nextIsMethod = withAsyncMethods.has(nextPart) || withMethods.has(nextPart) || nextPart.endsWith("|") && (withAsyncMethods.has(nextPart.slice(0, -1)) || withMethods.has(nextPart.slice(0, -1)));
    if (isAllowedAsyncMethod(part, withAsyncMethods, permissionProcessor) || isZeroArgAsync) {
      const method = current[baseName];
      if (typeof method === "function") {
        const appendArgs = permissionProcessor?.getMethodAppendArgs(baseName) ?? [];
        if (isZeroArgAsync || nextIsMethod) {
          current = await method.call(current, ...appendArgs);
        } else {
          current = await method.call(current, nextPart, ...appendArgs);
          i++;
        }
      } else {
        if (current[baseName] === void 0 || current[baseName] === null) {
          current[baseName] = {};
        }
        current = current[baseName];
      }
    } else if (isAllowedMethod2(part, withMethods, permissionProcessor) || isZeroArgSync) {
      const method = current[baseName];
      if (typeof method === "function") {
        const appendArgs = permissionProcessor?.getMethodAppendArgs(baseName) ?? [];
        if (isZeroArgSync || nextIsMethod) {
          current = method.call(current, ...appendArgs);
        } else {
          current = method.call(current, nextPart, ...appendArgs);
          i++;
        }
      } else {
        if (!(baseName in current) || typeof current[baseName] !== "object" || current[baseName] === null) {
          current[baseName] = {};
        }
        current = current[baseName];
      }
    } else {
      if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
        current[part] = {};
      }
      current = current[part];
    }
    i++;
  }
  const rawLastKey = pathParts[pathParts.length - 1];
  const isZeroArg = rawLastKey.endsWith("|") && (isAllowedMethod2(rawLastKey.slice(0, -1), withMethods, permissionProcessor) || isAllowedAsyncMethod(rawLastKey.slice(0, -1), withAsyncMethods, permissionProcessor));
  const lastKey = isZeroArg ? rawLastKey.slice(0, -1) : rawLastKey;
  return {
    target: current,
    lastKey,
    isMethod: isAllowedMethod2(lastKey, withMethods, permissionProcessor),
    isAsyncMethod: isAllowedAsyncMethod(lastKey, withAsyncMethods, permissionProcessor),
    isZeroArg
  };
}
var init_evaluatePathWithAsyncMethods = __esm({
  "../assign-gingerly/evaluatePathWithAsyncMethods.js"() {
    "use strict";
    init_assignGingerly();
  }
});

// ../assign-gingerly/enhanceAll.js
var enhanceAll_exports = {};
__export(enhanceAll_exports, {
  enhanceAll: () => enhanceAll
});
async function enhanceAll(target, configs, permissionProcessor) {
  for (const config of configs) {
    if (!permissionProcessor?.crossDomainImports && !isAllowedImportPath(config.emc)) {
      throw new Error(`enhanceAll: EMC path "${config.emc}" is a cross-domain URL. Only same-origin paths or import-map-covered specifiers are allowed by default. Pass { crossDomainImports: true } in permissionProcessor to override.`);
    }
    const emcModule = await import(config.emc);
    const emc = emcModule.default ?? emcModule;
    const { enhConfig } = emc;
    if (!enhConfig) {
      throw new Error(`enhanceAll: EMC at "${config.emc}" does not contain an enhConfig field`);
    }
    const selector = config.matching ?? enhConfig.matching ?? "*";
    const elements = target.querySelectorAll(selector);
    if (elements.length === 0)
      continue;
    const registryItem2 = await resolveAndRegister(enhConfig, target);
    if (!registryItem2)
      continue;
    for (const el of elements) {
      try {
        el.enh.get(registryItem2);
      } catch {
      }
    }
  }
}
async function resolveAndRegister(enhConfig, target) {
  const { enhKey, spawn: spawnPath } = enhConfig;
  const registry = target.customElementRegistry?.enhancementRegistry ?? (typeof customElements !== "undefined" ? customElements.enhancementRegistry : void 0);
  if (!registry)
    return null;
  if (enhKey) {
    const existing = registry.findByEnhKey(enhKey);
    if (existing)
      return existing;
  }
  if (!spawnPath)
    return null;
  let SpawnClass;
  try {
    SpawnClass = await findClassPrototypeInPath(spawnPath);
  } catch {
    return null;
  }
  const registryItem2 = {
    spawn: SpawnClass,
    enhKey
  };
  if (enhConfig.withAttrs) {
    registryItem2.withAttrs = enhConfig.withAttrs;
  }
  registry.push(registryItem2);
  return registryItem2;
}
var init_enhanceAll = __esm({
  "../assign-gingerly/enhanceAll.js"() {
    "use strict";
    init_isAllowedImportPath();
    init_findClassPrototypeInPath();
  }
});

// ../assign-gingerly/assignGingerly.js
var assignGingerly_exports = {};
__export(assignGingerly_exports, {
  EnhancementRegisteredEvent: () => EnhancementRegisteredEvent,
  EnhancementRegistry: () => EnhancementRegistry,
  INSTANCE_MAP_GUID: () => INSTANCE_MAP_GUID,
  ItemscopeRegistry: () => ItemscopeRegistry,
  applyAttribute: () => applyAttribute,
  assignGingerly: () => assignGingerly,
  default: () => assignGingerly_default,
  evaluatePathWithMethods: () => evaluatePathWithMethods,
  getInstanceMap: () => getInstanceMap,
  isAllowedMethod: () => isAllowedMethod2,
  isClassInstance: () => isClassInstance,
  isReadonlyProperty: () => isReadonlyProperty,
  tryAssignTo: () => tryAssignTo,
  whenEventsBound: () => whenEventsBound
});
function getInstanceMap() {
  if (!globalThis[INSTANCE_MAP_GUID]) {
    globalThis[INSTANCE_MAP_GUID] = /* @__PURE__ */ new WeakMap();
  }
  return globalThis[INSTANCE_MAP_GUID];
}
function isSymbolForKey(key) {
  return key.startsWith("[Symbol.for(") && key.endsWith(")]");
}
function parseSymbolForKey(key) {
  const match2 = key.match(/^\[Symbol\.for\(['"](.+)['"]\)\]$/);
  if (match2 && match2[1]) {
    return Symbol.for(match2[1]);
  }
  return null;
}
function isIncCommand(key) {
  return key.endsWith(" +=");
}
function isAttrCommand(key) {
  return key.endsWith(" :=");
}
function parseAttrCommand(key) {
  if (!isAttrCommand(key)) {
    return null;
  }
  return key.substring(0, key.length - 3);
}
function applyAttribute(element, name, value2, permissionProcessor) {
  if (!(typeof Element !== "undefined" && element instanceof Element)) {
    console.warn(`assignGingerly: ' :=' target for attribute "${name}" is not an Element \u2014 skipped.`);
    return;
  }
  if (/^on/i.test(name)) {
    throw new Error(`assignGingerly: ' :=' refuses event-handler attribute "${name}"; use ' +=' with { on: '${name.slice(2).toLowerCase()}', \u2026 } instead`);
  }
  let text;
  if (value2 === true) {
    text = "";
  } else if (value2 === false || value2 == null) {
    text = null;
  } else if (Array.isArray(value2)) {
    const tokens2 = value2.filter((item) => item != null && item !== false).map(String);
    text = tokens2.length > 0 ? tokens2.join(" ") : null;
  } else if (typeof value2 === "string" || typeof value2 === "number" || typeof value2 === "bigint") {
    text = String(value2);
  } else {
    console.warn(`assignGingerly: ' :=' value for attribute "${name}" must be a string, number, boolean, array or nullish (got ${typeof value2}) \u2014 skipped.`);
    return;
  }
  if (permissionProcessor?.checkRestrictedAttributeCall("setAttribute", [name, text ?? void 0]).blocked) {
    return;
  }
  if (text === null) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, text);
  }
}
function isEventConfig(value2) {
  return !!value2 && typeof value2 === "object" && !Array.isArray(value2) && "on" in value2;
}
function bindEvent(lhs, config, target, options, permissionProcessor) {
  const attached = Promise.resolve().then(() => (init_addEventListener(), addEventListener_exports)).then(({ attachEventListener: attachEventListener2 }) => {
    attachEventListener2(lhs, config, target, options?.from ?? target, options ?? {}, permissionProcessor);
  }).catch((error) => {
    if (typeof reportError === "function")
      reportError(error);
    else
      console.error(error);
  });
  const previous = pendingEventBindings.get(lhs);
  const all = previous ? Promise.all([previous, attached]).then(() => void 0) : attached;
  pendingEventBindings.set(lhs, all);
  all.then(() => {
    if (pendingEventBindings.get(lhs) === all)
      pendingEventBindings.delete(lhs);
  });
}
function whenEventsBound(element) {
  return pendingEventBindings.get(element) ?? Promise.resolve();
}
function parseIncCommand(key) {
  if (!isIncCommand(key)) {
    return null;
  }
  return key.substring(0, key.length - 3);
}
function addValue(lhs, rhs) {
  if (Array.isArray(lhs)) {
    return Array.isArray(rhs) ? [...lhs, ...rhs] : [...lhs, rhs];
  }
  if (typeof lhs === "number" && typeof rhs === "string") {
    const parsed = Number(rhs);
    return Number.isNaN(parsed) ? lhs + rhs : lhs + parsed;
  }
  if (typeof lhs === "string" && typeof rhs === "number") {
    const parsed = Number(lhs);
    return Number.isNaN(parsed) ? lhs + rhs : (parsed + rhs).toString();
  }
  return lhs + rhs;
}
function isToggleCommand(key) {
  return key.endsWith(" =!");
}
function parseToggleCommand(key) {
  if (!isToggleCommand(key)) {
    return null;
  }
  return key.substring(0, key.length - 3);
}
function isDeleteCommand(key) {
  return key.endsWith(" -=");
}
function parseDeleteCommand(key) {
  if (!isDeleteCommand(key)) {
    return null;
  }
  return key.substring(0, key.length - 3);
}
function isMergeCommand(key) {
  return key.endsWith(" Y=");
}
function parseMergeCommand(key) {
  if (!isMergeCommand(key)) {
    return null;
  }
  return key.substring(0, key.length - 3);
}
function parsePath(path) {
  let parts = agPathCache.get(path);
  if (!parts) {
    parts = path.split("?.").filter((part) => part.length > 0);
    agPathCache.set(path, parts);
  }
  return parts;
}
function isNestedPath(path) {
  return path.startsWith("?.");
}
function ensureNestedPath(obj, pathParts) {
  let current = obj;
  for (const part of pathParts.slice(0, -1)) {
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  return current;
}
function isReadonlyProperty(obj, propName) {
  let descriptor = Object.getOwnPropertyDescriptor(obj, propName);
  if (!descriptor) {
    let proto = Object.getPrototypeOf(obj);
    while (proto) {
      descriptor = Object.getOwnPropertyDescriptor(proto, propName);
      if (descriptor)
        break;
      proto = Object.getPrototypeOf(proto);
    }
  }
  if (!descriptor)
    return false;
  if ("value" in descriptor) {
    return descriptor.writable === false;
  }
  if ("get" in descriptor && descriptor.get !== void 0) {
    return descriptor.set === void 0;
  }
  return false;
}
function tryAssignTo(currentValue, value2, parent, key) {
  if (currentValue != null && typeof currentValue === "object") {
    const { constructor } = currentValue;
    if (constructor && Object.hasOwn(constructor, "assignTo") && typeof constructor.assignTo === "function") {
      constructor.assignTo(currentValue, value2, parent, key);
      return true;
    }
  }
  return false;
}
function isClassInstance(value2) {
  if (!value2 || typeof value2 !== "object")
    return false;
  if (Array.isArray(value2))
    return false;
  const proto = Object.getPrototypeOf(value2);
  return proto !== Object.prototype && proto !== null;
}
function isAllowedMethod2(methodName, withMethods, permissionProcessor) {
  return withMethods.has(methodName) && !permissionProcessor?.checkRestrictedMethod(methodName);
}
function evaluatePathWithMethods(target, pathParts, value2, withMethods, permissionProcessor) {
  let current = target;
  let i = 0;
  let lastSegmentConsumed = false;
  while (i < pathParts.length - 1) {
    const part = pathParts[i];
    const nextPart = pathParts[i + 1];
    const isZeroArgMethod = part.endsWith("|") && isAllowedMethod2(part.slice(0, -1), withMethods, permissionProcessor);
    const nextIsMethod = withMethods.has(nextPart) || nextPart.endsWith("|") && withMethods.has(nextPart.slice(0, -1));
    if (isAllowedMethod2(part, withMethods, permissionProcessor) || isZeroArgMethod) {
      const methodName = isZeroArgMethod ? part.slice(0, -1) : part;
      const method = current[methodName];
      if (typeof method === "function") {
        const appendArgs = permissionProcessor?.getMethodAppendArgs(methodName) ?? [];
        if (isZeroArgMethod || nextIsMethod) {
          current = method.call(current, ...appendArgs);
        } else {
          current = method.call(current, nextPart, ...appendArgs);
          i++;
          if (i === pathParts.length - 1) {
            lastSegmentConsumed = true;
          }
        }
      } else {
        if (!(methodName in current) || typeof current[methodName] !== "object" || current[methodName] === null) {
          current[methodName] = {};
        }
        current = current[methodName];
      }
    } else {
      if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
        current[part] = {};
      }
      current = current[part];
    }
    i++;
  }
  const rawLastKey = pathParts[pathParts.length - 1];
  const isZeroArg = rawLastKey.endsWith("|") && isAllowedMethod2(rawLastKey.slice(0, -1), withMethods, permissionProcessor);
  const lastKey = isZeroArg ? rawLastKey.slice(0, -1) : rawLastKey;
  return {
    target: current,
    lastKey,
    isMethod: isAllowedMethod2(lastKey, withMethods, permissionProcessor),
    isZeroArg,
    lastSegmentConsumed
  };
}
function isIterable(value2) {
  if (value2 == null)
    return false;
  if (typeof value2[Symbol.iterator] === "function")
    return true;
  if (Array.isArray(value2))
    return true;
  if (typeof value2.length === "number" && value2.length >= 0) {
    return true;
  }
  return false;
}
function isForEachSymbol(segment, aliasMap) {
  if (segment === "@each")
    return true;
  const aliasTarget = aliasMap.get(segment);
  return aliasTarget === "@each";
}
function isReactiveForEachSymbol(segment, aliasMap) {
  if (segment === "@eachTime")
    return true;
  const aliasTarget = aliasMap.get(segment);
  return aliasTarget === "@eachTime";
}
function applyToEach(iterable, remainingPath, value2, withMethods, aliasMap, options, permissionProcessor) {
  const items = Array.isArray(iterable) ? iterable : Array.from(iterable);
  for (const item of items) {
    if (remainingPath.length === 0) {
      continue;
    }
    const forEachIndex = remainingPath.findIndex((part) => isForEachSymbol(part, aliasMap));
    if (forEachIndex !== -1) {
      const pathToForEach = remainingPath.slice(0, forEachIndex);
      const pathAfterForEach = remainingPath.slice(forEachIndex + 1);
      let current = item;
      for (const part of pathToForEach) {
        const isZeroArgMethod = part.endsWith("|") && isAllowedMethod2(part.slice(0, -1), withMethods, permissionProcessor);
        if (isAllowedMethod2(part, withMethods, permissionProcessor) || isZeroArgMethod) {
          const methodName = isZeroArgMethod ? part.slice(0, -1) : part;
          const method = current[methodName];
          if (typeof method === "function") {
            const appendArgs = permissionProcessor?.getMethodAppendArgs(methodName) ?? [];
            if (isZeroArgMethod) {
              current = method.call(current, ...appendArgs);
              continue;
            }
            const nextIndex = pathToForEach.indexOf(part) + 1;
            const nextPart = pathToForEach[nextIndex];
            const nextIsMethod = nextPart && (withMethods.has(nextPart) || nextPart.endsWith("|") && withMethods.has(nextPart.slice(0, -1)));
            if (nextIsMethod) {
              current = method.call(current, ...appendArgs);
            } else if (nextPart) {
              current = method.call(current, nextPart, ...appendArgs);
              pathToForEach.splice(nextIndex, 1);
            } else {
              current = method.call(current, ...appendArgs);
            }
          } else {
            current = current[methodName];
          }
        } else {
          current = current[part];
        }
      }
      if (isIterable(current)) {
        applyToEach(current, pathAfterForEach, value2, withMethods, aliasMap, options, permissionProcessor);
      }
    } else {
      const result = evaluatePathWithMethods(item, remainingPath, value2, withMethods, permissionProcessor);
      if (result.isMethod) {
        const method = result.target[result.lastKey];
        if (typeof method === "function") {
          const appendArgs = permissionProcessor?.getMethodAppendArgs(result.lastKey) ?? [];
          if (result.isZeroArg) {
            method.call(result.target, ...appendArgs);
          } else if (Array.isArray(value2)) {
            method.apply(result.target, [...value2, ...appendArgs]);
          } else {
            method.call(result.target, value2, ...appendArgs);
          }
        }
      } else {
        const lastKey = result.lastKey;
        const parent = result.target;
        if (permissionProcessor?.redirectRestrictedProp(parent, lastKey, value2)) {
        } else if (typeof value2 === "object" && value2 !== null && !Array.isArray(value2)) {
          if (lastKey in parent && isReadonlyProperty(parent, lastKey)) {
            const currentValue = parent[lastKey];
            if (typeof currentValue !== "object" || currentValue === null) {
              throw new Error(`Cannot merge object into readonly primitive property '${String(lastKey)}'`);
            }
            assignGingerly(currentValue, value2, options, permissionProcessor);
          } else {
            parent[lastKey] = value2;
          }
        } else {
          parent[lastKey] = value2;
        }
      }
    }
  }
}
function resolveValueToNegate(rhsPath, target) {
  if (typeof rhsPath === "string" && isNestedPath(rhsPath)) {
    const rhsPathParts = parsePath(rhsPath);
    let current = target;
    let exists = true;
    for (const part of rhsPathParts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        exists = false;
        break;
      }
    }
    return exists ? current : true;
  }
  if (typeof rhsPath === "string") {
    return rhsPath in target ? target[rhsPath] : true;
  }
  return rhsPath;
}
function getIterableAtPath(target, pathParts, value2, withMethods, permissionProcessor) {
  const current = getValueAtPath(target, pathParts, value2, withMethods, permissionProcessor);
  return isIterable(current) ? current : void 0;
}
function getValueAtPath(target, pathParts, value2, withMethods, permissionProcessor) {
  let current = target;
  if (pathParts.length > 0) {
    if (withMethods && withMethods.size > 0) {
      const result = evaluatePathWithMethods(target, pathParts, value2, withMethods, permissionProcessor);
      if (result.lastSegmentConsumed) {
        current = result.target;
      } else if (result.isMethod) {
        const method = result.target[result.lastKey];
        if (typeof method === "function") {
          const appendArgs = permissionProcessor?.getMethodAppendArgs(result.lastKey) ?? [];
          current = method.call(result.target, ...appendArgs);
        } else {
          current = method;
        }
      } else {
        current = result.target[result.lastKey];
      }
    } else {
      for (const part of pathParts) {
        if (current == null)
          break;
        current = current[part];
      }
    }
  }
  return current;
}
function applyCommandToEach(target, pathParts, commandSuffix, value2, withMethods, aliasMap, options, permissionProcessor) {
  const forEachIndex = pathParts.findIndex((part) => isForEachSymbol(part, aliasMap));
  if (forEachIndex === -1)
    return;
  const pathToForEach = pathParts.slice(0, forEachIndex);
  const pathAfterForEach = pathParts.slice(forEachIndex + 1);
  const iterable = getIterableAtPath(target, pathToForEach, value2, withMethods, permissionProcessor);
  if (!iterable)
    return;
  const items = Array.isArray(iterable) ? iterable : Array.from(iterable);
  const syntheticKey = pathAfterForEach.length > 0 ? `?.${pathAfterForEach.join("?.")}${commandSuffix}` : commandSuffix;
  for (const item of items) {
    assignGingerly(item, { [syntheticKey]: value2 }, options, permissionProcessor);
  }
}
function applyAliases2(key, aliasMap) {
  if (aliasMap.size === 0)
    return key;
  const parts = key.split("?.");
  const substituted = parts.map((part) => {
    return aliasMap.get(part) ?? part;
  });
  return substituted.join("?.");
}
function assignGingerly(target, source, options, permissionProcessor) {
  if (!target || typeof target !== "object") {
    return target;
  }
  const { aliasMap, withMethods: withMethodsSet } = normalizeAliasOptions(options);
  const withAsyncMethodsSet = options?.withAsyncMethods ? options.withAsyncMethods instanceof Set ? options.withAsyncMethods : new Set(options.withAsyncMethods) : void 0;
  const enhancementRegistry = registryOption(options)?.enhancementRegistry;
  const registry = enhancementRegistry instanceof EnhancementRegistry ? enhancementRegistry : void 0;
  const processedSource = {};
  for (const key of Object.keys(source)) {
    if (isSymbolForKey(key)) {
      const symbol = parseSymbolForKey(key);
      if (symbol) {
        processedSource[symbol] = source[key];
      } else {
        processedSource[key] = source[key];
      }
    } else {
      const substitutedKey = applyAliases2(key, aliasMap);
      processedSource[substitutedKey] = source[key];
    }
  }
  for (const sym of Object.getOwnPropertySymbols(source)) {
    processedSource[sym] = source[sym];
  }
  if ("ish" in processedSource) {
    if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
      const ishValue = processedSource["ish"];
      delete processedSource["ish"];
      const itemscopeValue = target.getAttribute("itemscope");
      const setupPromise = (async () => {
        try {
          const { handleIshProperty: handleIshProperty2 } = await Promise.resolve().then(() => (init_handleIshProperty(), handleIshProperty_exports));
          await handleIshProperty2(target, ishValue, options, assignGingerly);
        } catch (err) {
          console.error("Error in handleIshProperty:", err);
          setTimeout(() => {
            throw err;
          }, 0);
        }
      })();
      if (itemscopeValue && typeof itemscopeValue === "string" && itemscopeValue.length > 0) {
        const registry2 = resolveRegistry("itemscopeRegistry", options, target);
        if (registry2 && typeof registry2._trackSetup === "function") {
          registry2._trackSetup(itemscopeValue, setupPromise);
        }
      }
    }
  }
  for (const key of Object.keys(processedSource)) {
    const value2 = processedSource[key];
    if (isAttrCommand(key)) {
      const path = parseAttrCommand(key);
      const pathParts = isNestedPath(path) ? parsePath(path) : path ? [path] : [];
      if (pathParts.some((part) => isForEachSymbol(part, aliasMap))) {
        applyCommandToEach(target, pathParts, " :=", value2, withMethodsSet, aliasMap, options, permissionProcessor);
        continue;
      }
      if (pathParts.length === 0) {
        console.warn(`assignGingerly: ' :=' needs an attribute name (key "${key}") \u2014 skipped.`);
        continue;
      }
      const rawName = pathParts[pathParts.length - 1];
      const name = aliasMap.get(rawName) ?? rawName;
      const element = pathParts.length > 1 ? getValueAtPath(target, pathParts.slice(0, -1), value2, withMethodsSet, permissionProcessor) : target;
      applyAttribute(element, name, value2, permissionProcessor);
      continue;
    }
    if (isIncCommand(key)) {
      const path = parseIncCommand(key);
      if (path === "" || path === "?.") {
        if (target instanceof Element && isEventConfig(value2)) {
          bindEvent(target, value2, target, options, permissionProcessor);
        }
        continue;
      }
      if (path) {
        if (isNestedPath(path)) {
          const pathParts = parsePath(path);
          if (pathParts.some((part) => isForEachSymbol(part, aliasMap))) {
            applyCommandToEach(target, pathParts, " +=", value2, withMethodsSet, aliasMap, options, permissionProcessor);
            continue;
          }
          let lhsValue;
          let lhsParent;
          let lhsKey;
          if (withMethodsSet) {
            const result = evaluatePathWithMethods(target, pathParts, value2, withMethodsSet, permissionProcessor);
            if (result.lastSegmentConsumed) {
              if (result.target instanceof Element && isEventConfig(value2)) {
                bindEvent(result.target, value2, target, options, permissionProcessor);
              }
              continue;
            }
            lhsParent = result.target;
            lhsKey = result.lastKey;
            lhsValue = lhsParent[lhsKey];
          } else {
            lhsKey = pathParts[pathParts.length - 1];
            lhsParent = ensureNestedPath(target, pathParts);
            lhsValue = lhsParent[lhsKey];
          }
          if (permissionProcessor?.checkRestrictedProp(lhsKey)) {
            continue;
          }
          if (lhsValue instanceof Element && isEventConfig(value2)) {
            bindEvent(lhsValue, value2, target, options, permissionProcessor);
            continue;
          }
          if (!(lhsKey in lhsParent)) {
            lhsParent[lhsKey] = value2;
          } else {
            lhsParent[lhsKey] = addValue(lhsValue, value2);
          }
        } else {
          if (permissionProcessor?.checkRestrictedProp(path)) {
            continue;
          }
          if (target[path] instanceof Element && isEventConfig(value2)) {
            bindEvent(target[path], value2, target, options, permissionProcessor);
            continue;
          }
          if (!(path in target)) {
            target[path] = value2;
          } else {
            target[path] = addValue(target[path], value2);
          }
        }
      }
      continue;
    }
    if (isToggleCommand(key)) {
      const lhsPath = parseToggleCommand(key);
      if (lhsPath) {
        const rhsPath = value2;
        if (isNestedPath(lhsPath)) {
          const lhsPathParts = parsePath(lhsPath);
          if (lhsPathParts.some((part) => isForEachSymbol(part, aliasMap))) {
            const resolvedValue = rhsPath === "." || typeof rhsPath !== "string" ? rhsPath : resolveValueToNegate(rhsPath, target);
            applyCommandToEach(target, lhsPathParts, " =!", resolvedValue, withMethodsSet, aliasMap, options, permissionProcessor);
            continue;
          }
          const lhsLastKey = lhsPathParts[lhsPathParts.length - 1];
          const lhsParent = ensureNestedPath(target, lhsPathParts);
          let valueToNegate;
          if (rhsPath === ".") {
            valueToNegate = lhsLastKey in lhsParent ? lhsParent[lhsLastKey] : void 0;
          } else {
            valueToNegate = resolveValueToNegate(rhsPath, target);
          }
          if (!permissionProcessor?.checkRestrictedProp(lhsLastKey)) {
            lhsParent[lhsLastKey] = !valueToNegate;
          }
        } else {
          const lhsLastKey = lhsPath;
          const lhsParent = target;
          let valueToNegate;
          if (rhsPath === ".") {
            valueToNegate = lhsLastKey in lhsParent ? lhsParent[lhsLastKey] : void 0;
          } else {
            valueToNegate = resolveValueToNegate(rhsPath, target);
          }
          if (!permissionProcessor?.checkRestrictedProp(lhsLastKey)) {
            lhsParent[lhsLastKey] = !valueToNegate;
          }
        }
      }
      continue;
    }
    if (isDeleteCommand(key)) {
      const path = parseDeleteCommand(key);
      if (path !== null) {
        let parent = target;
        let canDelete = true;
        if (isNestedPath(path)) {
          const pathParts = parsePath(path);
          if (pathParts.some((part) => isForEachSymbol(part, aliasMap))) {
            applyCommandToEach(target, pathParts, " -=", value2, withMethodsSet, aliasMap, options, permissionProcessor);
            continue;
          }
          if (pathParts.length === 0) {
            parent = target;
          } else {
            for (const part of pathParts) {
              if (parent && typeof parent === "object" && part in parent) {
                parent = parent[part];
              } else {
                canDelete = false;
                break;
              }
            }
          }
        } else if (path.length > 0) {
          if (parent && typeof parent === "object" && path in parent) {
            parent = parent[path];
          } else {
            canDelete = false;
          }
        }
        if (canDelete && typeof parent === "object" && parent !== null) {
          const propertiesToDelete = Array.isArray(value2) ? value2 : [value2];
          for (const prop of propertiesToDelete) {
            if (prop in parent) {
              delete parent[prop];
            }
          }
        }
      }
      continue;
    }
    if (isMergeCommand(key)) {
      const path = parseMergeCommand(key);
      if (path) {
        const pathParts = isNestedPath(path) ? parsePath(path) : [path];
        const lastKey = pathParts[pathParts.length - 1];
        if (permissionProcessor?.checkRestrictedProp(lastKey)) {
          continue;
        }
        if (isNestedPath(path) && pathParts.some((part) => isForEachSymbol(part, aliasMap))) {
          applyCommandToEach(target, pathParts, " Y=", value2, withMethodsSet, aliasMap, options, permissionProcessor);
          continue;
        }
        let mergeTarget;
        if (isNestedPath(path)) {
          if (withMethodsSet) {
            const result = evaluatePathWithMethods(target, parsePath(path), value2, withMethodsSet, permissionProcessor);
            mergeTarget = result.lastSegmentConsumed ? result.target : result.target[result.lastKey];
          } else {
            const pathParts2 = parsePath(path);
            mergeTarget = target;
            for (const part of pathParts2) {
              if (mergeTarget && typeof mergeTarget === "object" && part in mergeTarget) {
                mergeTarget = mergeTarget[part];
              } else {
                mergeTarget = void 0;
                break;
              }
            }
          }
        } else {
          mergeTarget = target[path];
        }
        if (mergeTarget && typeof mergeTarget === "object") {
          assignGingerly(mergeTarget, value2, options, permissionProcessor);
        }
      }
      continue;
    }
    if (isNestedPath(key)) {
      const pathParts = parsePath(key);
      const forEachIndex = pathParts.findIndex((part) => isForEachSymbol(part, aliasMap) || isReactiveForEachSymbol(part, aliasMap));
      if (forEachIndex !== -1) {
        const isReactive = isReactiveForEachSymbol(pathParts[forEachIndex], aliasMap);
        if (isReactive) {
          (async () => {
            try {
              const { handleEachTime: handleEachTime2 } = await Promise.resolve().then(() => (init_eachTime(), eachTime_exports));
              await handleEachTime2(target, pathParts, forEachIndex, value2, withMethodsSet, aliasMap, options, permissionProcessor);
            } catch (error) {
              console.error("Error in @eachTime:", error);
            }
          })();
          continue;
        }
        const pathToForEach = pathParts.slice(0, forEachIndex);
        const pathAfterForEach = pathParts.slice(forEachIndex + 1);
        const current = getIterableAtPath(target, pathToForEach, value2, withMethodsSet, permissionProcessor);
        if (current) {
          applyToEach(current, pathAfterForEach, value2, withMethodsSet || /* @__PURE__ */ new Set(), aliasMap, options, permissionProcessor);
        }
        continue;
      }
      if (withAsyncMethodsSet && pathParts.some((p) => withAsyncMethodsSet.has(p) || p.endsWith("|") && withAsyncMethodsSet.has(p.slice(0, -1)))) {
        const capturedTarget = target;
        const capturedPathParts = pathParts;
        const capturedValue = value2;
        const capturedWithMethodsSet = withMethodsSet || /* @__PURE__ */ new Set();
        const capturedOptions = options;
        const capturedPermissionProcessor = permissionProcessor;
        (async () => {
          const { evaluatePathWithAsyncMethods: evaluatePathWithAsyncMethods2 } = await Promise.resolve().then(() => (init_evaluatePathWithAsyncMethods(), evaluatePathWithAsyncMethods_exports));
          const result = await evaluatePathWithAsyncMethods2(capturedTarget, capturedPathParts, capturedValue, capturedWithMethodsSet, withAsyncMethodsSet, capturedPermissionProcessor);
          if (result.isMethod || result.isAsyncMethod) {
            const method = result.target[result.lastKey];
            if (typeof method === "function") {
              const appendArgs = capturedPermissionProcessor?.getMethodAppendArgs(result.lastKey) ?? [];
              const returnVal = result.isZeroArg ? method.call(result.target, ...appendArgs) : Array.isArray(capturedValue) ? method.apply(result.target, [...capturedValue, ...appendArgs]) : method.call(result.target, capturedValue, ...appendArgs);
              if (result.isAsyncMethod)
                await returnVal;
            }
          } else {
            const lastKey = result.lastKey;
            const parent = result.target;
            if (capturedPermissionProcessor?.redirectRestrictedProp(parent, lastKey, capturedValue)) {
            } else if (typeof capturedValue === "object" && capturedValue !== null && !Array.isArray(capturedValue)) {
              if (lastKey in parent && isReadonlyProperty(parent, lastKey)) {
                const currentValue = parent[lastKey];
                if (typeof currentValue !== "object" || currentValue === null) {
                  throw new Error(`Cannot merge object into readonly primitive property '${String(lastKey)}'`);
                }
                assignGingerly(currentValue, capturedValue, capturedOptions, capturedPermissionProcessor);
              } else {
                parent[lastKey] = capturedValue;
              }
            } else {
              parent[lastKey] = capturedValue;
            }
          }
        })();
        continue;
      }
      if (withMethodsSet) {
        const result = evaluatePathWithMethods(target, pathParts, value2, withMethodsSet, permissionProcessor);
        if (result.isMethod) {
          const method = result.target[result.lastKey];
          if (typeof method === "function") {
            const appendArgs = permissionProcessor?.getMethodAppendArgs(result.lastKey) ?? [];
            if (result.isZeroArg) {
              method.call(result.target, ...appendArgs);
            } else if (Array.isArray(value2)) {
              method.apply(result.target, [...value2, ...appendArgs]);
            } else {
              method.call(result.target, value2, ...appendArgs);
            }
          }
          continue;
        }
        const lastKey = result.lastKey;
        const parent = result.target;
        if (permissionProcessor?.redirectRestrictedProp(parent, lastKey, value2)) {
        } else if (lastKey in parent && tryAssignTo(parent[lastKey], value2, parent, lastKey)) {
          continue;
        } else if (typeof value2 === "object" && value2 !== null && !Array.isArray(value2)) {
          if (lastKey in parent && isReadonlyProperty(parent, lastKey)) {
            const currentValue = parent[lastKey];
            if (typeof currentValue !== "object" || currentValue === null) {
              throw new Error(`Cannot merge object into readonly primitive property '${String(lastKey)}'`);
            }
            assignGingerly(currentValue, value2, options, permissionProcessor);
          } else {
            parent[lastKey] = value2;
          }
        } else {
          parent[lastKey] = value2;
        }
      } else {
        const lastKey = pathParts[pathParts.length - 1];
        const parent = ensureNestedPath(target, pathParts);
        if (permissionProcessor?.redirectRestrictedProp(parent, lastKey, value2)) {
        } else if (lastKey in parent && tryAssignTo(parent[lastKey], value2, parent, lastKey)) {
          continue;
        } else if (typeof value2 === "object" && value2 !== null && !Array.isArray(value2)) {
          if (lastKey in parent && isReadonlyProperty(parent, lastKey)) {
            const currentValue = parent[lastKey];
            if (typeof currentValue !== "object" || currentValue === null) {
              throw new Error(`Cannot merge object into readonly primitive property '${String(lastKey)}'`);
            }
            assignGingerly(currentValue, value2, options, permissionProcessor);
          } else {
            parent[lastKey] = value2;
          }
        } else {
          parent[lastKey] = value2;
        }
      }
    } else {
      const isZeroArgKey = key.endsWith("|") && withMethodsSet !== void 0 && withMethodsSet.has(key.slice(0, -1));
      if (withMethodsSet && (withMethodsSet.has(key) || isZeroArgKey)) {
        const methodName = isZeroArgKey ? key.slice(0, -1) : key;
        const method = target[methodName];
        if (typeof method === "function") {
          const appendArgs = permissionProcessor?.getMethodAppendArgs(methodName) ?? [];
          if (isZeroArgKey) {
            method.call(target, ...appendArgs);
          } else if (Array.isArray(value2)) {
            method.apply(target, [...value2, ...appendArgs]);
          } else {
            method.call(target, value2, ...appendArgs);
          }
        }
        continue;
      }
      if (permissionProcessor?.redirectRestrictedProp(target, key, value2)) {
      } else if (key in target && tryAssignTo(target[key], value2, target, key)) {
        continue;
      } else if (typeof value2 === "object" && value2 !== null && !Array.isArray(value2)) {
        if (key in target && isReadonlyProperty(target, key)) {
          const currentValue = target[key];
          if (typeof currentValue !== "object" || currentValue === null) {
            throw new Error(`Cannot merge object into readonly primitive property '${String(key)}'`);
          }
          assignGingerly(currentValue, value2, options, permissionProcessor);
        } else {
          target[key] = value2;
        }
      } else {
        target[key] = value2;
      }
    }
  }
  const symbols = Object.getOwnPropertySymbols(processedSource);
  for (const sym of symbols) {
    const value2 = processedSource[sym];
    if (registry) {
      const registryItem2 = registry.findBySymbol(sym);
      if (registryItem2) {
        const instanceMap = getInstanceMap();
        const instances = instanceMap.getOrInsertComputed(target, () => /* @__PURE__ */ new Map());
        let instance = instances.get(registryItem2);
        if (!instance) {
          const SpawnClass = registryItem2.spawn;
          if (typeof SpawnClass.canSpawn === "function") {
            const ctx = { config: registryItem2 };
            if (!SpawnClass.canSpawn(target, ctx)) {
              continue;
            }
          }
          if (registryItem2.enhKey && typeof Element !== "undefined" && target instanceof Element) {
            const ctx = { config: registryItem2 };
            const initVals = target.enh?.[registryItem2.enhKey] && !(target.enh[registryItem2.enhKey] instanceof SpawnClass) ? target.enh[registryItem2.enhKey] : void 0;
            instance = new SpawnClass(target, ctx, initVals);
          } else {
            instance = new SpawnClass();
          }
          instances.set(registryItem2, instance);
          if (registryItem2.enhKey && typeof Element !== "undefined" && target instanceof Element) {
            if (!target.enh) {
              target.enh = {};
            }
            target.enh[registryItem2.enhKey] = instance;
          }
        }
        if (registryItem2.symlinks) {
          const mappedKey = registryItem2.symlinks[sym];
          if (mappedKey && instance && typeof instance === "object") {
            instance[mappedKey] = value2;
          }
        }
      }
    }
  }
  if (registry && !("set" in target)) {
    Object.defineProperty(target, "set", {
      get() {
        return new Proxy({}, {
          set: (_, prop, value2) => {
            if (typeof prop === "symbol") {
              const registryItem2 = registry.findBySymbol(prop);
              if (registryItem2) {
                const instanceMap = getInstanceMap();
                const instances = instanceMap.getOrInsertComputed(target, () => /* @__PURE__ */ new Map());
                let instance = instances.get(registryItem2);
                if (!instance) {
                  const SpawnClass = registryItem2.spawn;
                  if (typeof SpawnClass.canSpawn === "function") {
                    const ctx = { config: registryItem2 };
                    if (!SpawnClass.canSpawn(target, ctx)) {
                      return true;
                    }
                  }
                  if (registryItem2.enhKey && typeof Element !== "undefined" && target instanceof Element) {
                    const ctx = { config: registryItem2 };
                    const initVals = target.enh?.[registryItem2.enhKey] && !(target.enh[registryItem2.enhKey] instanceof SpawnClass) ? target.enh[registryItem2.enhKey] : void 0;
                    instance = new SpawnClass(target, ctx, initVals);
                  } else {
                    instance = new SpawnClass();
                  }
                  instances.set(registryItem2, instance);
                  if (registryItem2.enhKey && typeof Element !== "undefined" && target instanceof Element) {
                    if (!target.enh) {
                      target.enh = {};
                    }
                    target.enh[registryItem2.enhKey] = instance;
                  }
                }
                if (registryItem2.symlinks) {
                  const mappedKey = registryItem2.symlinks[prop];
                  if (mappedKey && instance && typeof instance === "object") {
                    instance[mappedKey] = value2;
                  }
                }
              }
            }
            return true;
          }
        });
      },
      configurable: true
    });
  }
  if (options?.enhance && options.enhance.length > 0 && typeof target === "object" && target instanceof Element) {
    Promise.resolve().then(() => (init_enhanceAll(), enhanceAll_exports)).then(({ enhanceAll: enhanceAll2 }) => {
      enhanceAll2(target, options.enhance, permissionProcessor);
    });
  }
  return target;
}
var DEFAULT_ENHANCEMENT_KEY, INSTANCE_MAP_GUID, EnhancementRegisteredEvent, EnhancementRegistry, ItemscopeRegistry, pendingEventBindings, agPathCache, assignGingerly_default;
var init_assignGingerly = __esm({
  "../assign-gingerly/assignGingerly.js"() {
    "use strict";
    init_getValues();
    init_resolveRegistry();
    DEFAULT_ENHANCEMENT_KEY = /* @__PURE__ */ Symbol("assign-gingerly.default-enhancement-setup");
    INSTANCE_MAP_GUID = "HDBhTPLuIUyooMxK88m68Q";
    EnhancementRegisteredEvent = class _EnhancementRegisteredEvent extends Event {
      config;
      static eventName = "register";
      constructor(config) {
        super(_EnhancementRegisteredEvent.eventName);
        this.config = config;
      }
    };
    EnhancementRegistry = class extends EventTarget {
      #items = /* @__PURE__ */ new Set();
      #pendingSetups = /* @__PURE__ */ new Map();
      /**
       * @param items - Optional enhancement configs to register right away (same as `push`)
       * @example
       * new EnhancementRegistry([{ symlinks: { [isHappy]: 'isHappy' }, spawn: MyEnhancement }]);
       */
      constructor(items) {
        super();
        if (items)
          this.push(items);
      }
      push(items) {
        if (Array.isArray(items)) {
          items.forEach((item) => this.#items.add(item));
        } else {
          this.#items.add(items);
        }
        this.dispatchEvent(new EnhancementRegisteredEvent(items));
        const itemsArr = Array.isArray(items) ? items : [items];
        for (const item of itemsArr) {
          if (item.features) {
            const promise = this.#assignFeatures(item.spawn, item.features);
            this._trackSetup(item.enhKey ?? DEFAULT_ENHANCEMENT_KEY, promise);
          }
        }
      }
      async #assignFeatures(spawn, features) {
        const { assignFeatures: assignFeatures2 } = await Promise.resolve().then(() => (init_assignFeatures(), assignFeatures_exports));
        const featuresRegistry = this._featuresRegistry ?? (typeof customElements !== "undefined" ? customElements.featuresRegistry : void 0);
        if (featuresRegistry) {
          await assignFeatures2(spawn, features, featuresRegistry);
        }
      }
      /**
       * Resolves once `enhKey` is defined -- i.e. registered via `push` -- and
       * ready (any pending `features` setup for it has settled). Mirrors
       * `customElements.whenDefined(name)`: if the key isn't registered yet, waits
       * for a future `push` that registers it; if it's never registered, this
       * never resolves (same tradeoff as the platform method).
       * @param enhKey - Enhancement key to wait for
       */
      async whenDefined(enhKey) {
        if (!this.findByEnhKey(enhKey)) {
          await new Promise((resolve) => {
            const handler = (event) => {
              const config = event.config;
              const items = Array.isArray(config) ? config : [config];
              if (items.some((item) => item.enhKey === enhKey)) {
                this.removeEventListener(EnhancementRegisteredEvent.eventName, handler);
                resolve();
              }
            };
            this.addEventListener(EnhancementRegisteredEvent.eventName, handler);
          });
        }
        const pending = this.#pendingSetups.get(enhKey);
        if (pending && pending.length > 0) {
          await Promise.all(pending);
        }
      }
      /**
       * Internal method to track a pending setup.
       * @param name - Setup key
       * @param promise - Promise representing the setup operation
       */
      _trackSetup(name, promise) {
        if (!this.#pendingSetups.has(name)) {
          this.#pendingSetups.set(name, []);
        }
        this.#pendingSetups.get(name).push(promise);
        promise.finally(() => {
          const pending = this.#pendingSetups.get(name);
          if (pending) {
            const index = pending.indexOf(promise);
            if (index > -1) {
              pending.splice(index, 1);
            }
          }
        });
      }
      getItems() {
        return Array.from(this.#items);
      }
      findBySymbol(symbol) {
        for (const item of this.#items) {
          const symlinks = item.symlinks;
          if (!symlinks)
            continue;
          const hasSymbol = Object.keys(symlinks).some((key) => {
            if (typeof key === "symbol" || typeof symlinks[key] === "symbol") {
              return key === symbol || symlinks[key] === symbol;
            }
            return false;
          }) || Object.getOwnPropertySymbols(symlinks).some((sym) => sym === symbol);
          if (hasSymbol)
            return item;
        }
        return void 0;
      }
      findByEnhKey(enhKey) {
        for (const item of this.#items) {
          if (item.enhKey === enhKey)
            return item;
        }
        return void 0;
      }
    };
    ItemscopeRegistry = class extends EventTarget {
      #configs = /* @__PURE__ */ new Map();
      #pendingSetups = /* @__PURE__ */ new Map();
      /**
       * @param managers - Optional managers to define right away, by name: each a manager class
       *   (shorthand for `{ manager: Class }`) or a full config. Same as calling `define` for each, in order.
       * @example
       * new ItemscopeRegistry({ 'crew-member-view': CrewMemberView, 'stage-view': { manager: StageView } });
       */
      constructor(managers) {
        super();
        if (managers) {
          for (const name of Object.keys(managers))
            this.define(name, managers[name]);
        }
      }
      /**
       * Define a new manager configuration
       * @param name - Manager name (matches itemscope attribute value)
       * @param config - Manager configuration object, or a manager class (shorthand for `{ manager: Class }`)
       * @throws Error if name is already registered
       */
      define(name, config) {
        if (typeof config === "function")
          config = { manager: config };
        if (this.#configs.has(name)) {
          throw new Error("Already registered");
        }
        this.#configs.set(name, config);
        this.dispatchEvent(new Event(name));
        if (config.features) {
          const promise = this.#assignFeatures(config.manager, config.features);
          this._trackSetup(name, promise);
        }
      }
      async #assignFeatures(manager, features) {
        const { assignFeatures: assignFeatures2 } = await Promise.resolve().then(() => (init_assignFeatures(), assignFeatures_exports));
        const featuresRegistry = this._featuresRegistry ?? (typeof customElements !== "undefined" ? customElements.featuresRegistry : void 0);
        if (featuresRegistry) {
          await assignFeatures2(manager, features, featuresRegistry);
        }
      }
      /**
       * Get a manager configuration by name
       * @param name - Manager name
       * @returns Manager configuration or undefined
       */
      get(name) {
        return this.#configs.get(name);
      }
      /**
       * Wait for a manager to be defined and all pending setups to complete
       * @param name - Manager name to wait for
       * @returns Promise that resolves when manager is defined and all setups are complete
       */
      async whenDefined(name) {
        if (!this.#configs.has(name)) {
          await new Promise((resolve) => {
            this.addEventListener(name, () => resolve(), { once: true });
          });
        }
        const pending = this.#pendingSetups.get(name);
        if (pending && pending.length > 0) {
          await Promise.all(pending);
        }
      }
      /**
       * Internal method to track a pending setup
       * @param name - Manager name
       * @param promise - Promise representing the setup operation
       */
      _trackSetup(name, promise) {
        if (!this.#pendingSetups.has(name)) {
          this.#pendingSetups.set(name, []);
        }
        this.#pendingSetups.get(name).push(promise);
        promise.finally(() => {
          const pending = this.#pendingSetups.get(name);
          if (pending) {
            const index = pending.indexOf(promise);
            if (index > -1) {
              pending.splice(index, 1);
            }
          }
        });
      }
    };
    pendingEventBindings = /* @__PURE__ */ new WeakMap();
    agPathCache = /* @__PURE__ */ new Map();
    assignGingerly_default = assignGingerly;
  }
});

// ../assign-gingerly/DX/pinCorrector.js
var pinCorrector_exports = {};
__export(pinCorrector_exports, {
  logConfigCorrection: () => logConfigCorrection
});
function computeChildPath(root, target) {
  const path = [];
  let current = target;
  while (current && current !== root) {
    const parent = current.parentElement;
    if (!parent)
      return null;
    const idx = Array.prototype.indexOf.call(parent.children, current);
    if (idx === -1)
      return null;
    path.unshift(idx);
    current = parent;
  }
  return current === root ? path : null;
}
function logConfigCorrection(target, varName, config) {
  if (!config.expect)
    return;
  const correctEl = target.querySelector?.(config.expect);
  if (!correctEl) {
    console.warn(`pin["${varName}"]: path [${config.path}] did not match "${config.expect}" and querySelector also found no match. Check that the selector is correct.`);
    return;
  }
  const correctPath = computeChildPath(target, correctEl);
  if (correctPath) {
    console.warn(`pin["${varName}"]: path [${config.path}] did not match "${config.expect}". Suggested correction: [${correctPath.join(", ")}]`);
  } else {
    console.warn(`pin["${varName}"]: path [${config.path}] did not match "${config.expect}". Could not compute a child index path (element may not be a descendant of target).`);
  }
}
var init_pinCorrector = __esm({
  "../assign-gingerly/DX/pinCorrector.js"() {
    "use strict";
  }
});

// ../assign-gingerly/resolve/resolveIdRef.js
function generateUniqueId(rootNode) {
  let counter = idCounterMap.get(rootNode) ?? 0;
  let id;
  do {
    id = `-ag:${counter}`;
    counter++;
  } while (rootNode.getElementById?.(id));
  idCounterMap.set(rootNode, counter);
  return id;
}
function resolveIdVariable(varName, target, pin) {
  const config = pin[varName];
  if (config === void 0)
    return void 0;
  if (Array.isArray(config)) {
    let current = target;
    for (const idx of config) {
      if (!current || !current.children)
        break;
      current = current.children[idx];
    }
    return current instanceof Element ? current : void 0;
  }
  if (typeof config === "object" && "path" in config && !("qry" in config)) {
    const rootNode2 = target.getRootNode?.() ?? target;
    let current = target;
    for (const idx of config.path) {
      if (!current || !current.children)
        break;
      current = current.children[idx];
    }
    let el2 = current instanceof Element ? current : null;
    if (config.expect) {
      const didNotMatch = !el2 || !el2.matches(config.expect);
      if (didNotMatch) {
        if (config.fallback) {
          el2 = target.querySelector?.(config.expect) ?? el2;
        }
        const capturedConfig = config;
        const capturedVarName = varName;
        Promise.resolve().then(() => (init_pinCorrector(), pinCorrector_exports)).then((module) => {
          module.logConfigCorrection(target, capturedVarName, capturedConfig);
        }).catch(() => {
        });
      }
    }
    if (!el2)
      return void 0;
    let id2 = el2.id;
    if (!id2) {
      id2 = generateUniqueId(rootNode2);
      el2.id = id2;
    }
    return el2;
  }
  const rootNode = target.getRootNode?.() ?? target;
  let cache = idCacheMap.get(rootNode);
  if (!cache) {
    cache = /* @__PURE__ */ new Map();
    idCacheMap.set(rootNode, cache);
  }
  let el = null;
  if (typeof config === "string") {
    const cached = cache.get(varName);
    if (cached) {
      const cachedEl = cached.ref.deref();
      if (cachedEl)
        return cachedEl;
      const el2 = rootNode.getElementById?.(cached.id);
      if (el2) {
        cache.set(varName, { id: cached.id, ref: new WeakRef(el2) });
        return el2;
      }
    }
    el = rootNode.getElementById?.(config) ?? null;
  } else {
    el = target.querySelector?.(config.qry) ?? null;
  }
  if (!el)
    return void 0;
  let id = el.id;
  if (!id) {
    id = generateUniqueId(rootNode);
    el.id = id;
  }
  if (typeof config === "string") {
    cache.set(varName, { id, ref: new WeakRef(el) });
  }
  return el;
}
function parseIdRef(key) {
  const closeIdx = key.indexOf("]");
  if (closeIdx === -1)
    return null;
  const varName = key.substring(2, closeIdx);
  if (!varName)
    return null;
  let remainingPath = key.substring(closeIdx + 1);
  if (remainingPath.endsWith(" =>")) {
    remainingPath = remainingPath.substring(0, remainingPath.length - 3);
  }
  return { varName, remainingPath };
}
function registerInCache(target, varName, element) {
  const rootNode = target.getRootNode?.() ?? target;
  let cache = idCacheMap.get(rootNode);
  if (!cache) {
    cache = /* @__PURE__ */ new Map();
    idCacheMap.set(rootNode, cache);
  }
  let id = element.id;
  if (!id) {
    id = generateUniqueId(rootNode);
    element.id = id;
  }
  cache.set(varName, { id, ref: new WeakRef(element) });
}
var idCacheMap, idCounterMap;
var init_resolveIdRef = __esm({
  "../assign-gingerly/resolve/resolveIdRef.js"() {
    "use strict";
    idCacheMap = /* @__PURE__ */ new WeakMap();
    idCounterMap = /* @__PURE__ */ new WeakMap();
  }
});

// ../assign-gingerly/inferencer/withScopePerimeter.js
function withScopePerimeter(rootNode, matchCandidate, outside) {
  let current = matchCandidate.parentElement;
  while (current && current !== rootNode) {
    if (current.matches(outside)) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}
var init_withScopePerimeter = __esm({
  "../assign-gingerly/inferencer/withScopePerimeter.js"() {
    "use strict";
  }
});

// ../assign-gingerly/inferencer/InferencedPropagator.js
var InferencedPropagator_exports = {};
__export(InferencedPropagator_exports, {
  InferencedPropagator: () => InferencedPropagator
});
var InferencedPropagator;
var init_InferencedPropagator = __esm({
  "../assign-gingerly/inferencer/InferencedPropagator.js"() {
    "use strict";
    init_inferencer();
    InferencedPropagator = class extends EventTarget {
      #infer;
      #watchedProperties = /* @__PURE__ */ new Map();
      constructor(infer) {
        super();
        this.#infer = infer;
      }
      addEventListener(type, callback, options) {
        super.addEventListener(type, callback, options);
        if (!this.#watchedProperties.has(type)) {
          this.#watchedProperties.set(type, () => {
          });
          this.#wireProperty(type);
        }
      }
      removeEventListener(type, callback, options) {
        super.removeEventListener(type, callback, options);
      }
      async #wireProperty(propName) {
        const element = this.#infer.enhancedElement;
        const initialValue = element[propName];
        const cleanup = await this.#setupStrategy(element, propName);
        this.#watchedProperties.set(propName, cleanup);
        const currentValue = element[propName];
        if (currentValue !== initialValue) {
          this.dispatchEvent(new Event(propName));
        }
      }
      /**
       * Determine and set up the best observation strategy for a property.
       * Returns a cleanup function.
       */
      async #setupStrategy(element, propName) {
        const attrName = this.#toAttributeName(propName);
        if (this.#isAttributeReflected(element, propName, attrName)) {
          return this.#observeAttribute(element, propName, attrName);
        }
        const eventType = this.#getNativeEventType(element, propName);
        if (eventType) {
          return this.#observeHybrid(element, propName, eventType);
        }
        const descriptor = this.#getPropertyDescriptor(element, propName);
        if (descriptor?.set) {
          return this.#interceptSetter(element, propName, descriptor);
        }
        return this.#observePolling(element, propName);
      }
      // ─── Strategy Implementations ────────────────────────────────────────
      /**
       * Strategy 1: Use MutationObserver on the corresponding attribute.
       */
      #observeAttribute(element, propName, attrName) {
        const observer = new MutationObserver(() => {
          this.dispatchEvent(new Event(propName));
        });
        observer.observe(element, {
          attributes: true,
          attributeFilter: [attrName]
        });
        return () => observer.disconnect();
      }
      /**
       * Strategy 2: Listen for native events AND intercept setter for programmatic changes.
       */
      #observeHybrid(element, propName, eventType) {
        const ac = new AbortController();
        const { signal } = ac;
        element.addEventListener(eventType, () => {
          this.dispatchEvent(new Event(propName));
        }, { signal });
        const descriptor = this.#getPropertyDescriptor(element, propName);
        let restoreSetter;
        if (descriptor?.set) {
          restoreSetter = this.#interceptSetter(element, propName, descriptor);
        }
        return () => {
          ac.abort();
          restoreSetter?.();
        };
      }
      /**
       * Strategy 3: Override the property setter on the instance to detect programmatic writes.
       */
      #interceptSetter(element, propName, descriptor) {
        const originalSet = descriptor.set;
        const originalGet = descriptor.get;
        const self2 = this;
        Object.defineProperty(element, propName, {
          get: originalGet ? function() {
            return originalGet.call(this);
          } : void 0,
          set(newValue) {
            const oldValue = originalGet ? originalGet.call(this) : void 0;
            originalSet.call(this, newValue);
            if (newValue !== oldValue) {
              self2.dispatchEvent(new Event(propName));
            }
          },
          configurable: true,
          enumerable: descriptor.enumerable
        });
        return () => {
          delete element[propName];
        };
      }
      /**
       * Strategy 4: Polling via requestAnimationFrame.
       */
      #observePolling(element, propName) {
        let active = true;
        let lastValue = element[propName];
        const poll = () => {
          if (!active)
            return;
          const currentValue = element[propName];
          if (currentValue !== lastValue) {
            lastValue = currentValue;
            this.dispatchEvent(new Event(propName));
          }
          requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
        return () => {
          active = false;
        };
      }
      // ─── Helpers ─────────────────────────────────────────────────────────
      /**
       * Convert a camelCase property name to its kebab-case attribute equivalent.
       * e.g. ariaValueNow -> aria-valuenow
       */
      #toAttributeName(propName) {
        if (propName.startsWith("aria")) {
          return propName.replace(/([A-Z])/g, "-$1").toLowerCase();
        }
        return propName.replace(/([A-Z])/g, "-$1").toLowerCase();
      }
      /**
       * Check if setting a property updates the corresponding attribute.
       */
      #isAttributeReflected(element, propName, attrName) {
        const { localName } = element;
        if (propName === "value" && ["input", "textarea", "select", "button"].includes(localName)) {
          return false;
        }
        if (propName === "value" && ["data", "meter", "output", "progress"].includes(localName)) {
          return true;
        }
        if (element.hasAttribute(attrName))
          return true;
        if (propName.startsWith("aria"))
          return true;
        const reflectedProps = {
          "href": ["a", "area", "link", "base"],
          "src": ["img", "script", "iframe", "audio", "video", "source", "embed"],
          "action": ["form"],
          "value": ["option", "param", "li"]
        };
        if (reflectedProps[propName]?.includes(localName))
          return true;
        return false;
      }
      /**
       * Determine the native event type that fires when a property changes (user-driven).
       * Leverages Infer's inferEventType for elements known to have input-like behavior.
       */
      #getNativeEventType(element, propName) {
        const { localName } = element;
        if (["input", "textarea", "select"].includes(localName)) {
          if (propName === "value" || propName === "valueAsNumber" || propName === "valueAsDate" || propName === "checked" || propName === "selectedIndex") {
            return inferEventType(element);
          }
        }
        if (localName === "details" && propName === "open") {
          return "toggle";
        }
        if (element instanceof HTMLElement && element.isContentEditable) {
          if (propName === "textContent" || propName === "innerHTML" || propName === "innerText") {
            return "input";
          }
        }
        return void 0;
      }
      /**
       * Walk the prototype chain to find a property descriptor.
       */
      #getPropertyDescriptor(element, propName) {
        let proto = Object.getPrototypeOf(element);
        while (proto && proto !== Object.prototype) {
          const desc = Object.getOwnPropertyDescriptor(proto, propName);
          if (desc)
            return desc;
          proto = Object.getPrototypeOf(proto);
        }
        return void 0;
      }
      /**
       * Tear down all watchers and clean up resources.
       */
      destroy() {
        for (const cleanup of this.#watchedProperties.values()) {
          cleanup();
        }
        this.#watchedProperties.clear();
      }
    };
  }
});

// ../assign-gingerly/inferencer/inferencer.js
function inferValueProperty(element) {
  const itemscope = element.getAttribute("itemscope");
  if (itemscope !== null && itemscope !== "") {
    return "ish";
  }
  const { localName } = element;
  switch (localName) {
    case "input": {
      const type = element.getAttribute("type")?.toLowerCase();
      switch (type) {
        case "checkbox":
        case "radio":
          return "checked";
        case "number":
        case "range":
          return "valueAsNumber";
        default:
          return "value";
      }
    }
    case "textarea":
    case "select":
    case "data":
    case "meter":
    case "progress":
    case "output":
      return "value";
    case "time":
      return "dateTime";
    case "a":
    case "area":
      return "href";
    default: {
      return "textContent";
    }
  }
}
function coerceElementValue(element, propName = inferValueProperty(element)) {
  const raw = element[propName];
  switch (propName) {
    case "valueAsNumber":
      return Number.isNaN(raw) ? void 0 : raw;
    case "valueAsDate":
      return raw ?? void 0;
    case "checked":
    case "selectedIndex":
      return raw;
    case "dateTime": {
      const s = raw == null ? "" : String(raw);
      return s === "" ? void 0 : new Date(s);
    }
  }
  if (raw == null)
    return void 0;
  if (typeof raw !== "string")
    return raw;
  switch (element.getAttribute("itemtype")) {
    case "https://schema.org/Number":
      return Number(raw);
    case "https://schema.org/Integer":
      return parseInt(raw, 10);
    case "https://schema.org/Float":
      return parseFloat(raw);
    case "https://schema.org/Boolean":
      return raw === "true" || raw === "True";
    case "https://schema.org/Date":
    case "https://schema.org/DateTime":
      return new Date(raw);
  }
  if (propName === "textContent")
    return raw;
  if (raw === "")
    return void 0;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
function serializeForProperty(propName, nv) {
  switch (propName) {
    case "checked":
    case "valueAsNumber":
    case "valueAsDate":
      return nv;
  }
  if (nv instanceof Date)
    return nv.toISOString();
  if (nv !== null && typeof nv === "object")
    return JSON.stringify(nv);
  return nv;
}
function resolveLang(element) {
  let node = element;
  while (node != null) {
    if (node.nodeType === 1) {
      const el = node;
      const lang = el.getAttribute("lang") || el.getAttribute("xml:lang");
      if (lang)
        return lang;
      node = node.parentNode;
    } else if (node.nodeType === 11) {
      node = node.host ?? null;
    } else {
      node = null;
    }
  }
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  return typeof navigator !== "undefined" && navigator.language || void 0;
}
function inferDisplayProperty(element) {
  const { localName } = element;
  switch (localName) {
    case "input":
    case "textarea":
    case "select":
      return "value";
    case "meter":
    case "progress":
      return "ariaValueText";
    case "time":
    case "data":
    default:
      return "textContent";
  }
}
function inferEventType(element) {
  const { localName } = element;
  switch (localName) {
    case "input":
    case "textarea":
    case "select":
      return "input";
    case "form":
      return "submit";
    case "details":
      return "toggle";
    case "dialog":
      return "close";
    default:
      return "click";
  }
}
function inferBindingProperty(element) {
  return element.getAttribute("itemprop") || element.getAttribute("name") || element.getAttribute("id") || "value";
}
var value, display, Infer, registryItem;
var init_inferencer = __esm({
  "../assign-gingerly/inferencer/inferencer.js"() {
    "use strict";
    init_withScopePerimeter();
    value = /* @__PURE__ */ Symbol.for("inferencer:value");
    display = /* @__PURE__ */ Symbol.for("inferencer:display");
    Infer = class _Infer {
      #weakRef;
      #propName;
      #propagator;
      get enhancedElement() {
        return this.#weakRef.deref();
      }
      constructor(enhancedElement, propName) {
        this.#weakRef = new WeakRef(enhancedElement);
        this.#propName = propName;
      }
      /**
       * Get a propagator (EventTarget) that emits events when properties change.
       * For custom elements with a native propagator (roundabout), returns that directly.
       * Otherwise, creates an InferencedPropagator that uses best-effort strategies
       * to detect property changes.
       */
      async getPropagator() {
        if (this.#propagator)
          return this.#propagator;
        const { enhancedElement } = this;
        const { localName } = enhancedElement;
        if (localName.includes("-")) {
          await (enhancedElement.customElementRegistry || customElements).whenDefined(localName);
          const { propagator } = enhancedElement;
          if (propagator instanceof EventTarget) {
            this.#propagator = propagator;
            return propagator;
          }
        }
        const { InferencedPropagator: InferencedPropagator2 } = await Promise.resolve().then(() => (init_InferencedPropagator(), InferencedPropagator_exports));
        this.#propagator = new InferencedPropagator2(this);
        return this.#propagator;
      }
      #value;
      get value() {
        const element = this.#weakRef.deref();
        if (element === void 0)
          return this.#value;
        const propName = typeof this.#propName === "string" ? this.#propName : inferValueProperty(element);
        return coerceElementValue(element, propName);
      }
      set value(nv) {
        this.#value = nv;
        const { enhancedElement } = this;
        const propName = typeof this.#propName === "string" ? this.#propName : inferValueProperty(enhancedElement);
        enhancedElement[propName] = serializeForProperty(propName, nv);
      }
      #display;
      get display() {
        return this.#display;
      }
      set display(nv) {
        this.#display = nv;
        const { enhancedElement } = this;
        enhancedElement[inferDisplayProperty(enhancedElement)] = nv;
      }
      /**
       * Get the inferred event type for the element
       * @returns The most appropriate event type for this element
       */
      get eventType() {
        return inferEventType(this.enhancedElement);
      }
      /**
       * Get the inferred value property name for the element
       * @returns The property name used for value assignment (e.g. 'value', 'checked', 'dateTime')
       */
      get valueProperty() {
        return inferValueProperty(this.enhancedElement);
      }
      /**
       * The effective language for this element, honoring `lang` / `xml:lang`
       * inheritance up through ancestors and shadow-root hosts, then
       * `<html lang>` and finally `navigator.language`.
       * @returns a BCP-47 tag, or undefined if nothing is resolvable
       */
      get lang() {
        const el = this.#weakRef.deref();
        return el === void 0 ? void 0 : resolveLang(el);
      }
      ["|"](itempropAttr, scopeBoundary = "[itemscope]") {
        return this.#queryScoped(`[itemprop="${itempropAttr}"]`, itempropAttr, scopeBoundary);
      }
      ["@"](nameAttr, scopeBoundary) {
        return this.#queryScoped(`[name="${nameAttr}"]`, nameAttr, scopeBoundary);
      }
      ["%"](partAttr, scopeBoundary) {
        return this.#queryScoped(`[part~="${partAttr}"]`, partAttr, scopeBoundary);
      }
      ["#"](id, scopeBoundary) {
        return this.#queryScoped(`#${id}`, id, scopeBoundary);
      }
      ["."](className, scopeBoundary) {
        return this.#queryScoped(`.${className}`, className, scopeBoundary);
      }
      #queryScoped(selector, propName, scopeBoundary) {
        const candidates = this.enhancedElement.querySelectorAll(selector);
        const filtered = scopeBoundary ? Array.from(candidates).filter((el) => withScopePerimeter(this.enhancedElement, el, scopeBoundary)) : Array.from(candidates);
        return filtered.map((x) => new _Infer(x, propName));
      }
      setDisplay(vm) {
        const val = this.#propName ? vm[this.#propName] : inferBindingProperty(this.enhancedElement);
        this.display = val;
      }
      get defaultRemoteBindingPropName() {
        const { enhancedElement } = this;
        return enhancedElement.getAttribute("itemprop") || enhancedElement.getAttribute("name") || enhancedElement.getAttribute("id") || "value";
      }
    };
    registryItem = {
      spawn: Infer,
      enhKey: "inferencer",
      symlinks: {
        [value]: "value",
        [display]: "display"
      }
    };
  }
});

// ../assign-gingerly/inferredAssignments.js
function itempropsInScope(target, from) {
  const plain = Object.getPrototypeOf(from) === Object.prototype || Object.getPrototypeOf(from) === null;
  const names = /* @__PURE__ */ new Set();
  for (const el of target.querySelectorAll("[itemprop]")) {
    if (!withScopePerimeter(target, el, "[itemscope]"))
      continue;
    if (el.getAttribute("itemscope") === "")
      continue;
    const name = el.getAttribute("itemprop");
    if (names.has(name))
      continue;
    const provided = Object.hasOwn(from, name) || !plain && name in from && typeof from[name] !== "function";
    if (provided)
      names.add(name);
  }
  return [...names];
}
function processInferredAssignments(target, from, config) {
  if (!(target instanceof Element))
    return;
  if (!from || typeof from !== "object")
    return;
  const { byItemprop, byName } = config;
  const effectiveByItemprop = byItemprop ?? config["|"];
  const effectiveByName = byName ?? config["@"];
  if (effectiveByItemprop) {
    const keys = effectiveByItemprop === true ? itempropsInScope(target, from) : effectiveByItemprop;
    const infer = new Infer(target);
    for (const key of keys) {
      if (!(key in from))
        continue;
      const value2 = from[key];
      const matches = infer["|"](key);
      for (const match2 of matches) {
        if (match2.enhancedElement.getAttribute("itemscope") === "")
          continue;
        new Infer(match2.enhancedElement).value = value2;
      }
    }
  }
  if (effectiveByName) {
    let keys;
    let scopeBoundary;
    if (effectiveByName === true) {
      keys = Object.keys(from);
    } else if (Array.isArray(effectiveByName)) {
      keys = effectiveByName;
    } else {
      keys = effectiveByName.props === true ? Object.keys(from) : effectiveByName.props;
      scopeBoundary = effectiveByName.outside;
    }
    const infer = new Infer(target);
    for (const key of keys) {
      if (!(key in from))
        continue;
      const value2 = from[key];
      const matches = infer["@"](key, scopeBoundary);
      for (const match2 of matches) {
        new Infer(match2.enhancedElement).value = value2;
      }
    }
  }
}
var init_inferredAssignments = __esm({
  "../assign-gingerly/inferredAssignments.js"() {
    "use strict";
    init_inferencer();
    init_withScopePerimeter();
  }
});

// ../assign-gingerly/utils/resolveLhsPath.js
function resolveLhsPath(target, lhsPath, options) {
  let lhsTarget;
  let lhsParent = void 0;
  let lhsKey = void 0;
  const { aliasMap, withMethods: withMethodsSet } = normalizeAliasOptions(options);
  if (aliasMap.size > 0) {
    lhsPath = lhsPath.startsWith("?.") ? applyAliases(lhsPath, aliasMap) : aliasMap.get(lhsPath) ?? lhsPath;
  }
  if (lhsPath.startsWith("?.")) {
    const pathParts = lhsPath.split("?.").filter((p) => p.length > 0);
    if (withMethodsSet && pathParts.length > 0) {
      const result = evaluatePathWithMethods(target, pathParts, void 0, withMethodsSet);
      lhsParent = result.target;
      lhsKey = result.lastKey;
      lhsTarget = result.target[result.lastKey];
      if (result.lastSegmentConsumed) {
        lhsTarget = result.target;
        lhsParent = void 0;
        lhsKey = void 0;
      } else if (result.isMethod && typeof result.target[result.lastKey] === "function") {
        lhsTarget = result.target[result.lastKey].call(result.target);
        lhsParent = void 0;
        lhsKey = void 0;
      }
    } else {
      if (pathParts.length === 0) {
        lhsTarget = target;
      } else if (pathParts.length === 1) {
        lhsParent = target;
        lhsKey = pathParts[0];
        lhsTarget = target[pathParts[0]];
      } else {
        let current = target;
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (current == null)
            break;
          current = current[pathParts[i]];
        }
        lhsParent = current;
        lhsKey = pathParts[pathParts.length - 1];
        lhsTarget = current != null ? current[lhsKey] : void 0;
      }
    }
  } else if (lhsPath) {
    lhsParent = target;
    lhsKey = lhsPath;
    lhsTarget = target[lhsPath];
  } else {
    lhsTarget = target;
  }
  return { lhsTarget, lhsParent, lhsKey };
}
var init_resolveLhsPath = __esm({
  "../assign-gingerly/utils/resolveLhsPath.js"() {
    "use strict";
    init_assignGingerly();
    init_getValues();
  }
});

// ../assign-gingerly/syncOps/join.js
function processValue(value2) {
  const result = [];
  for (const item of value2) {
    if (Array.isArray(item)) {
      if (item.some((el) => el == null)) {
        continue;
      }
      result.push(...processValue(item));
    } else if (item != null) {
      result.push(item);
    }
  }
  return result;
}
function join(args, extra = {}) {
  const { separator = "" } = extra;
  const items = Array.isArray(args) ? processValue(args) : [args];
  return items.join(separator);
}
var init_join = __esm({
  "../assign-gingerly/syncOps/join.js"() {
    "use strict";
  }
});

// ../assign-gingerly/syncOps/registry.js
var SYNC_OPS;
var init_registry = __esm({
  "../assign-gingerly/syncOps/registry.js"() {
    "use strict";
    init_join();
    init_microJoin();
    SYNC_OPS = {
      join,
      microJoin
    };
  }
});

// ../assign-gingerly/handlers/snippets.js
function parsedSnippet(spec, options, permissionProcessor, doc) {
  const html = snippetSource(spec, options.snippets);
  const key = permissionProcessor ?? NO_PROCESSOR;
  let byHtml = parsedSnippets.get(key);
  if (!byHtml)
    parsedSnippets.set(key, byHtml = /* @__PURE__ */ new Map());
  let parsed = byHtml.get(html);
  if (!parsed) {
    parsed = parseSnippet(spec.snippet, html, permissionProcessor, doc);
    byHtml.set(html, parsed);
  }
  return parsed;
}
function withSnippetProtocol(options, permissionProcessor) {
  const snippets = options?.snippets;
  if (!snippets)
    return options;
  const existing = options.protocols?.snippets;
  if (existing && !(existing[BUILT_IN] && (existing[BUILT_IN].snippets !== snippets || existing[BUILT_IN].permissionProcessor !== permissionProcessor))) {
    return options;
  }
  const handler = (name) => {
    const { template } = parsedSnippet({ snippet: name }, options, permissionProcessor, document);
    templateNames.set(template, name);
    return template;
  };
  handler[BUILT_IN] = { snippets, permissionProcessor };
  return { ...options, protocols: { ...options.protocols, snippets: handler } };
}
function parseSnippet(name, html, permissionProcessor, doc) {
  const template = doc.createElement("template");
  template.innerHTML = html;
  const tags = [];
  for (const node of template.content.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      tags.push(node.localName);
    } else if (node.nodeType !== Node.TEXT_NODE || node.data.trim() !== "") {
      throw new Error(`builtIns.tree: snippet "${name}" has ${node.nodeType === Node.TEXT_NODE ? "text" : "a comment"} at its top level; only elements (and whitespace between them) can be there: wrap it in an element`);
    }
  }
  if (tags.length === 0)
    throw new Error(`builtIns.tree: snippet "${name}" has no element`);
  checkContent(name, template.content, permissionProcessor);
  return { html, template, tags, holes: findHoles(name, template.content) };
}
function findHoles(name, content) {
  const holes = /* @__PURE__ */ new Map();
  for (const el of content.querySelectorAll(`[${HOLE_ATTRIBUTE}]`)) {
    const hole = el.getAttribute(HOLE_ATTRIBUTE);
    if (holes.has(hole))
      throw new Error(`builtIns.tree: snippet "${name}" has two holes named "${hole}"`);
    if (el.parentElement?.closest(`[${HOLE_ATTRIBUTE}]`)) {
      throw new Error(`builtIns.tree: snippet "${name}" has a hole ("${hole}") inside another hole, which isn't supported`);
    }
    const path = [];
    for (let at = el; ; at = at.parentElement) {
      const parent = at.parentElement;
      path.unshift([...(parent ?? content).children].indexOf(at));
      if (!parent)
        break;
    }
    holes.set(hole, path);
  }
  for (const el of content.querySelectorAll(`[${HOLE_ATTRIBUTE}]`))
    el.removeAttribute(HOLE_ATTRIBUTE);
  return holes;
}
function checkContent(name, root, permissionProcessor) {
  for (const el of root.querySelectorAll("*")) {
    const { localName } = el;
    if (localName === "script")
      throw new Error(`builtIns.tree: snippet "${name}" contains a <script>, which snippets can't`);
    for (const { name: attr, value: value2 } of el.attributes) {
      const lower = attr.toLowerCase();
      if (lower.startsWith("on"))
        throw new Error(`builtIns.tree: snippet "${name}" has an event handler attribute (${attr} on <${localName}>), which snippets can't; bind events in the tree`);
      if (URL_ATTRIBUTES.has(lower) && /^\s*javascript:/i.test(value2)) {
        throw new Error(`builtIns.tree: snippet "${name}" has a javascript: URL (${attr} on <${localName}>)`);
      }
      if (permissionProcessor?.checkRestrictedAttributeCall("setAttribute", [attr, value2]).blocked) {
        throw new Error(`builtIns.tree: snippet "${name}" has an attribute the permission profile blocks (${attr} on <${localName}>)`);
      }
    }
    if (localName === "template") {
      const { content } = el;
      if (content.querySelector(`[${HOLE_ATTRIBUTE}]`)) {
        throw new Error(`builtIns.tree: snippet "${name}" has a hole inside a nested <template>, which isn't supported (yet)`);
      }
      checkContent(name, content, permissionProcessor);
    }
  }
}
var HOLE_ATTRIBUTE, URL_ATTRIBUTES, parsedSnippets, NO_PROCESSOR, templateNames, BUILT_IN;
var init_snippets = __esm({
  "../assign-gingerly/handlers/snippets.js"() {
    "use strict";
    init_treeSpec();
    HOLE_ATTRIBUTE = "data-hole";
    URL_ATTRIBUTES = /* @__PURE__ */ new Set(["href", "src", "action", "formaction", "xlink:href", "poster", "data"]);
    parsedSnippets = /* @__PURE__ */ new WeakMap();
    NO_PROCESSOR = {};
    templateNames = /* @__PURE__ */ new WeakMap();
    BUILT_IN = /* @__PURE__ */ Symbol("snippets protocol");
  }
});

// ../assign-gingerly/beVigilant.js
var beVigilant_exports = {};
__export(beVigilant_exports, {
  setupVigilantObserver: () => setupVigilantObserver
});
function setupVigilantObserver(target, from, config, signal) {
  const keys = config.byItemprop === true ? null : new Set(config.byItemprop);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element))
            continue;
          processElement(node, from, keys, target);
          const nested = node.querySelectorAll("[itemprop]");
          for (const el of nested) {
            processElement(el, from, keys, target);
          }
        }
      } else if (mutation.type === "attributes" && mutation.target instanceof Element) {
        processElement(mutation.target, from, keys, target);
      }
    }
  });
  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["itemprop"]
  });
  signal.addEventListener("abort", () => observer.disconnect(), { once: true });
}
function processElement(element, from, keys, scopeRoot) {
  const itemprop = element.getAttribute("itemprop");
  if (!itemprop)
    return;
  if (keys && !keys.has(itemprop))
    return;
  if (!(itemprop in from))
    return;
  if (!withScopePerimeter(scopeRoot, element, "[itemscope]"))
    return;
  new Infer(element).value = from[itemprop];
  registerInCache(scopeRoot, itemprop, element);
}
var init_beVigilant = __esm({
  "../assign-gingerly/beVigilant.js"() {
    "use strict";
    init_inferencer();
    init_withScopePerimeter();
    init_resolveIdRef();
  }
});

// ../assign-gingerly/resolve/resolveValues.js
async function resolveProtocolValue(value2, protocols, options) {
  const { protocol, key, path } = parseProtocolRef(value2);
  const handler = protocols[protocol];
  if (!handler)
    return value2;
  const resolved = await handler(key);
  if (path) {
    return getValue(path, resolved, options);
  }
  return resolved;
}
async function resolveArray(arr2, source, protocols, options) {
  const result = [];
  for (const item of arr2) {
    if (typeof item === "string") {
      if (protocols && hasProtocol(item)) {
        result.push(await resolveProtocolValue(item, protocols, options));
      } else {
        result.push(getValue(item, source, options));
      }
    } else if (Array.isArray(item)) {
      result.push(await resolveArray(item, source, protocols, options));
    } else if (item && typeof item === "object") {
      if (isPlainObject(item)) {
        result.push(options?.protocols ? await resolveValues(item, source, options) : getValues(item, source, options));
      } else {
        result.push(item);
      }
    } else {
      result.push(item);
    }
  }
  return result;
}
async function resolveValues(pattern, source, options) {
  const protocols = options?.protocols;
  const result = {};
  for (const [key, value2] of Object.entries(pattern)) {
    if (typeof value2 === "string") {
      if (protocols && hasProtocol(value2)) {
        result[key] = await resolveProtocolValue(value2, protocols, options);
      } else {
        result[key] = getValue(value2, source, options);
      }
    } else if (Array.isArray(value2)) {
      result[key] = await resolveArray(value2, source, protocols, options);
    } else if (isEventBinding(key, value2)) {
      const { get } = value2;
      result[key] = isPlainObject(get) ? { ...value2, get: options?.protocols ? await resolveValues(get, source, options) : getValues(get, source, options) } : value2;
    } else if (typeof value2 === "object" && value2 !== null) {
      if (isPlainObject(value2)) {
        result[key] = options?.protocols ? await resolveValues(value2, source, options) : getValues(value2, source, options);
      } else {
        result[key] = value2;
      }
    } else {
      result[key] = value2;
    }
  }
  return result;
}
var init_resolveValues = __esm({
  "../assign-gingerly/resolve/resolveValues.js"() {
    "use strict";
    init_getValues();
  }
});

// ../assign-gingerly/processHandlerCommands.js
var processHandlerCommands_exports = {};
__export(processHandlerCommands_exports, {
  processHandlerCommands: () => processHandlerCommands
});
function handlerCriteria(proto) {
  return "assign" in proto.prototype;
}
function isThenable2(value2) {
  return value2 != null && typeof value2.then === "function";
}
function loadBuiltIn(name) {
  const cached = handlerCache.get(name);
  if (cached)
    return cached;
  const path = BUILT_IN_MAP[name];
  if (!path)
    return void 0;
  return findClassPrototypeInPath(new URL(path, import.meta.url).pathname, handlerCriteria).then((cls) => {
    handlerCache.set(name, cls);
    return cls;
  });
}
function resolveHandler(name, handlers) {
  if (handlers && name in handlers) {
    const entry = handlers[name];
    if (typeof entry === "function") {
      return entry;
    }
    if (typeof entry === "string") {
      if (entry.startsWith("builtIns.")) {
        return loadBuiltIn(entry);
      }
      const cached = pathCache2.get(entry);
      if (cached)
        return cached;
      return findClassPrototypeInPath(entry, handlerCriteria).then((cls) => {
        pathCache2.set(entry, cls);
        return cls;
      });
    }
  }
  if (name.startsWith("builtIns.")) {
    return loadBuiltIn(name);
  }
  return void 0;
}
function processHandlerCommands(target, handlerKeys, pattern, options, permissionProcessor) {
  return runKeys(target, handlerKeys, 0, pattern, options, permissionProcessor);
}
function runKeys(target, handlerKeys, start, pattern, options, permissionProcessor) {
  for (let i = start; i < handlerKeys.length; i++) {
    const key = handlerKeys[i];
    const lhsPath = key.substring(0, key.length - 3);
    const configs = normalizeConfigs(key, pattern[key]);
    if (configs.length === 0)
      continue;
    const lhs = resolveLhsPath(target, lhsPath, options);
    const pending = runConfigs(configs, 0, lhs, target, options, permissionProcessor);
    if (pending)
      return pending.then(() => runKeys(target, handlerKeys, i + 1, pattern, options, permissionProcessor));
  }
}
function normalizeConfigs(key, rhs) {
  const configs = Array.isArray(rhs) ? rhs : [rhs];
  for (const config of configs) {
    if (Array.isArray(config)) {
      throw new Error(`assignFrom: handler command "${key}" does not support nested arrays`);
    }
    if (!config || typeof config !== "object" || !config.do) {
      throw new Error(`assignFrom: handler command "${key}" requires a config object with a "do" field`);
    }
  }
  return configs;
}
function runConfigs(configs, start, lhs, target, options, permissionProcessor) {
  for (let i = start; i < configs.length; i++) {
    const pending = runConfig(configs[i], lhs, target, options, permissionProcessor);
    if (pending)
      return pending.then(() => runConfigs(configs, i + 1, lhs, target, options, permissionProcessor));
  }
}
function runConfig(config, lhs, target, options, permissionProcessor) {
  const handlerClass = resolveHandler(config.do, options.handlers);
  if (isThenable2(handlerClass)) {
    return handlerClass.then((cls) => invokeHandler(cls, config, lhs, target, options, permissionProcessor));
  }
  return invokeHandler(handlerClass, config, lhs, target, options, permissionProcessor);
}
function invokeHandler(HandlerClass, config, lhs, target, options, permissionProcessor) {
  if (!HandlerClass) {
    throw new Error(`assignFrom: unknown handler "${config.do}". Provide it in options.handlers.`);
  }
  const { get, resolve } = config;
  if (!get && !resolve)
    return prepareAndAssign(HandlerClass, config, {}, lhs, options, permissionProcessor);
  const { from, withMethods, aka, substitutions, protocols, fromStack, pipes } = options;
  const resolveOptions2 = { withMethods, aka, substitutions, protocols, root: target, fromStack, pipes };
  const resolvedParams = get ? getValues(get, from, resolveOptions2) : {};
  if (resolve) {
    return resolveValues(resolve, from, resolveOptions2).then((asyncResolved) => {
      Object.assign(resolvedParams, asyncResolved);
      return prepareAndAssign(HandlerClass, config, resolvedParams, lhs, options, permissionProcessor);
    });
  }
  return prepareAndAssign(HandlerClass, config, resolvedParams, lhs, options, permissionProcessor);
}
function prepareAndAssign(HandlerClass, config, resolvedParams, lhs, options, permissionProcessor) {
  const preparing = HandlerClass.prepare?.(config);
  if (preparing)
    return preparing.then(() => assignWith(HandlerClass, config, resolvedParams, lhs, options, permissionProcessor));
  return assignWith(HandlerClass, config, resolvedParams, lhs, options, permissionProcessor);
}
function assignWith(HandlerClass, config, resolvedParams, lhs, options, permissionProcessor) {
  const handler = new HandlerClass(config);
  const result = handler.assign(lhs.lhsTarget, resolvedParams, options, permissionProcessor);
  if (isThenable2(result))
    return Promise.resolve(result).then((value2) => applyResult(lhs, value2, permissionProcessor));
  applyResult(lhs, result, permissionProcessor);
}
function applyResult({ lhsParent, lhsKey }, result, permissionProcessor) {
  if (result !== void 0 && lhsParent != null && lhsKey != null && !permissionProcessor?.redirectRestrictedProp(lhsParent, lhsKey, result)) {
    lhsParent[lhsKey] = result;
  }
}
var BUILT_IN_MAP, handlerCache, pathCache2;
var init_processHandlerCommands = __esm({
  "../assign-gingerly/processHandlerCommands.js"() {
    "use strict";
    init_resolveValues();
    init_getValues();
    init_resolveLhsPath();
    init_findClassPrototypeInPath();
    BUILT_IN_MAP = {
      "builtIns.lazyLoad": "./handlers/lazyLoad.js",
      "builtIns.lazyLoadSwitch": "./handlers/lazyLoadSwitch.js",
      "builtIns.manageTemplateList": "./handlers/manageTemplateList.js",
      "builtIns.rangeSelector": "./handlers/rangeSelector.js",
      "builtIns.scope": "./handlers/scope.js",
      "builtIns.tree": "./handlers/tree.js"
    };
    handlerCache = /* @__PURE__ */ new Map();
    pathCache2 = /* @__PURE__ */ new Map();
  }
});

// ../assign-gingerly/assignFrom.js
var assignFrom_exports = {};
__export(assignFrom_exports, {
  SUBSTITUTION_VARS: () => SUBSTITUTION_VARS,
  assignFrom: () => assignFrom,
  categorizeKeys: () => categorizeKeys,
  default: () => assignFrom_default,
  entryContainsPlaceholder: () => entryContainsPlaceholder,
  expandSubstitutions: () => expandSubstitutions,
  handleSpreads: () => handleSpreads,
  isHandlerCommand: () => isHandlerCommand,
  isMultiInvokeCommand: () => isMultiInvokeCommand,
  isSyncOpCommand: () => isSyncOpCommand,
  isTernaryCommand: () => isTernaryCommand,
  loadHandlerCommands: () => loadHandlerCommands,
  mergeHandlerDuplicates: () => mergeHandlerDuplicates,
  parseMultiInvokeCommand: () => parseMultiInvokeCommand,
  parseSyncOpCommand: () => parseSyncOpCommand,
  parseTernaryCommand: () => parseTernaryCommand,
  substituteInValue: () => substituteInValue,
  valueContainsPlaceholder: () => valueContainsPlaceholder,
  whenSettled: () => whenSettled
});
function isHandlerCommand(key) {
  return key.endsWith(" =>");
}
function isTernaryCommand(key) {
  return key.endsWith(" ?=");
}
function parseTernaryCommand(key) {
  if (!isTernaryCommand(key))
    return null;
  return key.substring(0, key.length - 3);
}
function isSyncOpCommand(key) {
  return key.endsWith(" =&");
}
function parseSyncOpCommand(key) {
  if (!isSyncOpCommand(key))
    return null;
  return key.substring(0, key.length - 3);
}
function isMultiInvokeCommand(key) {
  return key.endsWith(" =*");
}
function parseMultiInvokeCommand(key) {
  if (!isMultiInvokeCommand(key))
    return null;
  return key.substring(0, key.length - 3);
}
function assertNoThenable(value2, opName, key) {
  if (value2 == null)
    return;
  if (typeof value2.then === "function") {
    throw new Error(`assignFrom: sync op '${opName}' (key "${key}") received an async value \u2014 a protocol in options.protocols returned a Promise, which ' =&' cannot await. Use ' =>' with 'resolve:' instead for async values.`);
  }
  if (Array.isArray(value2)) {
    for (const item of value2)
      assertNoThenable(item, opName, key);
  } else if (typeof value2 === "object") {
    const proto = Object.getPrototypeOf(value2);
    if (proto === Object.prototype || proto === null) {
      for (const item of Object.values(value2))
        assertNoThenable(item, opName, key);
    }
  }
}
function resolveTernaryValue(value2, source, options) {
  if (typeof value2 === "string" && (value2.startsWith("?.") || isFromStackReference(value2))) {
    return getValue(value2, source, {
      withMethods: options.withMethods,
      aka: options.aka,
      substitutions: options.substitutions,
      protocols: options.protocols,
      root: options.root,
      fromStack: options.fromStack,
      pipes: options.pipes
    });
  }
  if (typeof value2 === "string" && value2.includes("://") && options.protocols) {
    const protoEnd = value2.indexOf("://");
    const protocol = value2.substring(0, protoEnd);
    if (options.protocols[protocol]) {
      return getValue(value2, source, {
        withMethods: options.withMethods,
        aka: options.aka,
        substitutions: options.substitutions,
        protocols: options.protocols,
        root: options.root
      });
    }
  }
  return value2;
}
function isNestedTernary(value2) {
  if (!Array.isArray(value2) || value2.length < 2)
    return false;
  const first = value2[0];
  return Array.isArray(first) || typeof first === "string" && (first.startsWith("?.") || isFromStackReference(first));
}
function resolveResult(value2, source, options) {
  if (isNestedTernary(value2)) {
    return evaluateTernary(value2, source, options);
  }
  return resolveTernaryValue(value2, source, options);
}
function evaluateTernary(arr2, source, options) {
  const condition = arr2[0];
  if (Array.isArray(condition)) {
    const lhs = resolveTernaryValue(condition[0], source, options);
    if (condition.length === 2) {
      const rhs = resolveTernaryValue(condition[1], source, options);
      if (lhs === rhs) {
        return resolveResult(arr2[1], source, options);
      } else {
        return arr2.length > 2 ? resolveResult(arr2[2], source, options) : TERNARY_SKIP;
      }
    } else {
      const op = condition[1];
      const rhs = resolveTernaryValue(condition[2], source, options);
      const satisfied = compareWithOp(lhs, op, rhs);
      if (satisfied) {
        return resolveResult(arr2[1], source, options);
      } else {
        return arr2.length > 2 ? resolveResult(arr2[2], source, options) : TERNARY_SKIP;
      }
    }
  } else {
    if (arr2[1] === "||" || arr2[1] === "??") {
      return evaluateChain(arr2, source, options);
    }
    const resolved = resolveTernaryValue(condition, source, options);
    if (arr2.length === 4) {
      if (resolved == null)
        return resolveResult(arr2[3], source, options);
      return resolved ? resolveResult(arr2[1], source, options) : resolveResult(arr2[2], source, options);
    } else if (arr2.length === 3) {
      return resolved ? resolveResult(arr2[1], source, options) : resolveResult(arr2[2], source, options);
    } else {
      return resolved ? resolveResult(arr2[1], source, options) : TERNARY_SKIP;
    }
  }
}
function evaluateChain(arr2, source, options) {
  const isNullish = arr2[1] === "??";
  const n = arr2.length;
  const endsWithMarker = arr2[n - 1] === "||" || arr2[n - 1] === "??";
  const lastCandidateIdx = n - (endsWithMarker || n % 2 === 0 ? 2 : 1);
  let lastVal;
  for (let i = 0; i <= lastCandidateIdx; i += 2) {
    lastVal = resolveResult(arr2[i], source, options);
    if (lastVal === TERNARY_SKIP)
      continue;
    const pass = isNullish ? lastVal != null : !!lastVal;
    if (pass)
      return lastVal;
  }
  if (endsWithMarker)
    return TERNARY_SKIP;
  return n % 2 === 1 ? lastVal : resolveResult(arr2[n - 1], source, options);
}
function compareWithOp(lhs, op, rhs) {
  switch (op) {
    case "===":
      return lhs === rhs;
    case "!==":
      return lhs !== rhs;
    case ">":
      return lhs > rhs;
    case ">=":
      return lhs >= rhs;
    case "<":
      return lhs < rhs;
    case "<=":
      return lhs <= rhs;
    default:
      return lhs === rhs;
  }
}
function substituteInValue(value2, placeholder, replacement) {
  if (typeof value2 === "string") {
    return value2.includes(placeholder) ? value2.replaceAll(placeholder, replacement) : value2;
  }
  if (Array.isArray(value2)) {
    return value2.map((item) => substituteInValue(item, placeholder, replacement));
  }
  if (value2 && typeof value2 === "object") {
    const proto = Object.getPrototypeOf(value2);
    if (proto === Object.prototype || proto === null) {
      const result = {};
      for (const [k, v] of Object.entries(value2)) {
        result[k] = substituteInValue(v, placeholder, replacement);
      }
      return result;
    }
  }
  return value2;
}
function entryContainsPlaceholder(key, value2, placeholder) {
  if (key.includes(placeholder))
    return true;
  return valueContainsPlaceholder(value2, placeholder);
}
function valueContainsPlaceholder(value2, placeholder) {
  if (typeof value2 === "string")
    return value2.includes(placeholder);
  if (Array.isArray(value2))
    return value2.some((item) => valueContainsPlaceholder(item, placeholder));
  if (value2 && typeof value2 === "object") {
    const proto = Object.getPrototypeOf(value2);
    if (proto === Object.prototype || proto === null) {
      return Object.values(value2).some((v) => valueContainsPlaceholder(v, placeholder));
    }
  }
  return false;
}
function expandSubstitutions(pattern, options) {
  let entries = Object.entries(pattern);
  for (const { placeholder, optionKey } of SUBSTITUTION_VARS) {
    const values = options[optionKey];
    if (!values || values.length === 0)
      continue;
    const expanded = [];
    for (const [key, value2] of entries) {
      if (entryContainsPlaceholder(key, value2, placeholder)) {
        for (const replacement of values) {
          const newKey = key.includes(placeholder) ? key.replaceAll(placeholder, replacement) : key;
          const newValue = substituteInValue(value2, placeholder, replacement);
          expanded.push([newKey, newValue]);
        }
      } else {
        expanded.push([key, value2]);
      }
    }
    entries = expanded;
  }
  return mergeHandlerDuplicates(entries);
}
function mergeHandlerDuplicates(entries) {
  const result = {};
  for (const [key, value2] of entries) {
    if (key in result && key.endsWith(" =*") && Array.isArray(result[key]) && Array.isArray(value2)) {
      result[key] = result[key].concat(value2);
    } else if (key.endsWith(" =>") && key in result) {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(value2);
      } else {
        result[key] = [existing, value2];
      }
    } else {
      result[key] = value2;
    }
  }
  return result;
}
function handleSpreads(obj) {
  for (const [key, value2] of Object.entries(obj)) {
    if (key !== "..." && typeof value2 === "object" && value2 !== null && !Array.isArray(value2)) {
      const proto = Object.getPrototypeOf(value2);
      if (proto === Object.prototype || proto === null) {
        obj[key] = handleSpreads(value2);
      }
    }
  }
  if ("..." in obj) {
    const spreadValue = obj["..."];
    delete obj["..."];
    if (spreadValue && typeof spreadValue === "object") {
      Object.assign(obj, spreadValue);
    }
  }
  return obj;
}
function categorizeKeys(expandedPattern) {
  const handlerKeys = [];
  const normalPattern = {};
  const idRefNormalKeys = [];
  const idRefHandlerKeys = [];
  const ternaryKeys = [];
  const syncOpKeys = [];
  const multiInvokeKeys = [];
  for (const key of Object.keys(expandedPattern)) {
    if (isHandlerCommand(key)) {
      if (key.startsWith("#[")) {
        idRefHandlerKeys.push(key);
      } else {
        handlerKeys.push(key);
      }
    } else if (isTernaryCommand(key)) {
      ternaryKeys.push(key);
    } else if (isSyncOpCommand(key)) {
      syncOpKeys.push(key);
    } else if (isMultiInvokeCommand(key)) {
      multiInvokeKeys.push(key);
    } else if (key.startsWith("#[")) {
      idRefNormalKeys.push(key);
    } else {
      normalPattern[key] = expandedPattern[key];
    }
  }
  return { handlerKeys, normalPattern, idRefNormalKeys, idRefHandlerKeys, ternaryKeys, syncOpKeys, multiInvokeKeys };
}
function getEffectiveIds(options) {
  if (!options.pin && !options.at)
    return void 0;
  if (options.pin && !options.at)
    return options.pin;
  if (!options.pin && options.at)
    return options.at;
  return { ...options.pin, ...options.at };
}
function processIdRefNormalKeys(idRefNormalKeys, expandedPattern, target, options, permissionProcessor) {
  const ids = getEffectiveIds(options);
  if (!ids)
    return;
  const { withMethods, aka, akaMethods, protocols, from, substitutions, fromStack, pipes } = options;
  for (const key of idRefNormalKeys) {
    const parsed = parseIdRef(key);
    if (!parsed)
      continue;
    const el = resolveIdVariable(parsed.varName, target, ids);
    if (!el)
      continue;
    const value2 = expandedPattern[key];
    if (parsed.remainingPath) {
      const resolvedValue = getValues({ __v: value2 }, from, { withMethods, aka, akaMethods, substitutions, protocols, root: target, fromStack, pipes, permissionProcessor });
      assignGingerly_default(el, { [parsed.remainingPath]: resolvedValue.__v }, options, permissionProcessor);
    } else {
      const resolvedValue = getValues(typeof value2 === "object" && value2 !== null ? value2 : { __v: value2 }, from, { withMethods, aka, akaMethods, substitutions, protocols, root: target, fromStack, pipes, permissionProcessor });
      if (!("__v" in resolvedValue)) {
        assignGingerly_default(el, resolvedValue, options, permissionProcessor);
      }
    }
  }
}
function assignFrom(target, pattern, options, permissionProcessor) {
  options = withSnippetProtocol(options, permissionProcessor);
  const expandedPattern = expandSubstitutions(pattern, options);
  const { handlerKeys, normalPattern, idRefNormalKeys, idRefHandlerKeys, ternaryKeys, syncOpKeys, multiInvokeKeys } = categorizeKeys(expandedPattern);
  const resolveOptions2 = { ...options, root: target, permissionProcessor };
  if (ternaryKeys.length > 0) {
    const ternaryResolved = {};
    for (const key of ternaryKeys) {
      const lhsPath = parseTernaryCommand(key);
      if (!lhsPath)
        continue;
      const arr2 = expandedPattern[key];
      if (!Array.isArray(arr2) || arr2.length < 2)
        continue;
      const result = evaluateTernary(arr2, options.from, resolveOptions2);
      if (result !== TERNARY_SKIP) {
        ternaryResolved[lhsPath] = result;
      }
    }
    if (Object.keys(ternaryResolved).length > 0) {
      assignGingerly_default(target, ternaryResolved, options, permissionProcessor);
    }
  }
  if (syncOpKeys.length > 0) {
    for (const key of syncOpKeys) {
      const lhsPath = parseSyncOpCommand(key);
      if (lhsPath === null)
        continue;
      const config = expandedPattern[key];
      if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw new Error(`assignFrom: sync-op command "${key}" requires a config object naming exactly one op`);
      }
      const opName = Object.keys(config).find((k) => k in SYNC_OPS);
      if (!opName) {
        throw new Error(`assignFrom: sync-op command "${key}" does not name a known op (${Object.keys(SYNC_OPS).join(", ")})`);
      }
      const resolvedConfig = getValues(config, options.from, resolveOptions2);
      assertNoThenable(resolvedConfig, opName, key);
      const { [opName]: args, ...extra } = resolvedConfig;
      const { lhsTarget, lhsParent, lhsKey } = resolveLhsPath(target, lhsPath, options);
      const result = SYNC_OPS[opName](args, extra, {
        lhsTarget,
        lhsParent,
        lhsKey,
        rawArgs: config[opName],
        protocols: options.protocols
      });
      if (result === void 0)
        continue;
      if (lhsParent != null && lhsKey != null && !permissionProcessor?.redirectRestrictedProp(lhsParent, lhsKey, result)) {
        lhsParent[lhsKey] = result;
      }
    }
  }
  if (multiInvokeKeys.length > 0) {
    for (const key of multiInvokeKeys) {
      const basePath = parseMultiInvokeCommand(key);
      if (basePath === null)
        continue;
      const callList = expandedPattern[key];
      if (!Array.isArray(callList)) {
        throw new Error(`assignFrom: multi-invoke command "${key}" requires an array of argument-lists`);
      }
      for (const rawArgs of callList) {
        const argList = Array.isArray(rawArgs) ? rawArgs : [rawArgs];
        const resolved = getValues({ __args: argList }, options.from, resolveOptions2).__args;
        assignGingerly_default(target, { [basePath]: resolved }, options, permissionProcessor);
      }
    }
  }
  if (Object.keys(normalPattern).length > 0) {
    if (options.pin || options.at) {
      const ids = getEffectiveIds(options);
      for (const key of Object.keys(normalPattern)) {
        const value2 = normalPattern[key];
        if (typeof value2 === "string" && value2.startsWith("#[")) {
          const closeIdx = value2.indexOf("]");
          if (closeIdx !== -1) {
            const varName = value2.substring(2, closeIdx);
            const el = resolveIdVariable(varName, target, ids);
            if (el) {
              const remainingPath = value2.substring(closeIdx + 1);
              if (remainingPath) {
                normalPattern[key] = getValue(remainingPath, el, {
                  withMethods: options.withMethods,
                  aka: options.aka,
                  akaMethods: options.akaMethods,
                  substitutions: options.substitutions,
                  protocols: options.protocols,
                  root: target,
                  fromStack: options.fromStack,
                  pipes: options.pipes,
                  permissionProcessor
                });
              } else {
                normalPattern[key] = el.id;
              }
            }
          }
        }
      }
    }
    const resolved = getValues(normalPattern, options.from, resolveOptions2);
    handleSpreads(resolved);
    assignGingerly_default(target, resolved, options, permissionProcessor);
  }
  if (idRefNormalKeys.length > 0) {
    processIdRefNormalKeys(idRefNormalKeys, expandedPattern, target, options, permissionProcessor);
  }
  if (handlerKeys.length > 0) {
    runHandlerCommands(target, (processHandlerCommands2) => processHandlerCommands2(target, handlerKeys, expandedPattern, options, permissionProcessor));
  }
  if (idRefHandlerKeys.length > 0 && (options.pin || options.at)) {
    const ids = getEffectiveIds(options);
    runHandlerCommands(target, (processHandlerCommands2) => {
      const pending = [];
      for (const key of idRefHandlerKeys) {
        const parsed = parseIdRef(key);
        if (!parsed)
          continue;
        const el = resolveIdVariable(parsed.varName, target, ids);
        if (!el)
          continue;
        const syntheticKey = parsed.remainingPath ? `${parsed.remainingPath} =>` : " =>";
        const syntheticPattern = { [syntheticKey]: expandedPattern[key] };
        const run2 = attempt(() => processHandlerCommands2(el, [syntheticKey], syntheticPattern, options, permissionProcessor));
        if (run2)
          pending.push(run2);
      }
      return pending.length > 0 ? Promise.all(pending).then(() => void 0) : void 0;
    });
  }
  if (options.infer) {
    processInferredAssignments(target, options.from, options.infer);
    if (options.infer.beVigilant) {
      if (!options.signal) {
        throw new Error("assignFrom: infer.beVigilant requires options.signal (AbortSignal) for cleanup");
      }
      Promise.resolve().then(() => (init_beVigilant(), beVigilant_exports)).then(({ setupVigilantObserver: setupVigilantObserver2 }) => {
        setupVigilantObserver2(target, options.from, options.infer, options.signal);
      });
    }
  }
  if (options.enhance && options.enhance.length > 0) {
    trackPending(target, Promise.resolve().then(() => (init_enhanceAll(), enhanceAll_exports)).then(({ enhanceAll: enhanceAll2 }) => enhanceAll2(target, options.enhance, permissionProcessor)));
  }
  return target;
}
function loadHandlerCommands() {
  return cachedProcessHandlerCommands ?? Promise.resolve().then(() => (init_processHandlerCommands(), processHandlerCommands_exports)).then(({ processHandlerCommands: processHandlerCommands2 }) => cachedProcessHandlerCommands = processHandlerCommands2);
}
function attempt(run2) {
  try {
    return run2();
  } catch (error) {
    return Promise.reject(error);
  }
}
function runHandlerCommands(target, use) {
  const loaded = loadHandlerCommands();
  if (typeof loaded === "function") {
    const pending = attempt(() => use(loaded));
    if (pending)
      trackPending(target, pending);
    return;
  }
  trackPending(target, loaded.then(use));
}
function trackPending(target, work) {
  const settled = work.then(() => void 0, (error) => {
    if (typeof reportError === "function")
      reportError(error);
    else
      console.error(error);
  });
  if (target === null || typeof target !== "object" && typeof target !== "function")
    return;
  const previous = pendingWork.get(target);
  const all = previous ? Promise.all([previous, settled]).then(() => void 0) : settled;
  pendingWork.set(target, all);
  all.then(() => {
    if (pendingWork.get(target) === all)
      pendingWork.delete(target);
  });
}
function whenSettled(target) {
  const trackable = target !== null && (typeof target === "object" || typeof target === "function");
  return trackable && pendingWork.get(target) || Promise.resolve();
}
var SUBSTITUTION_VARS, TERNARY_SKIP, cachedProcessHandlerCommands, pendingWork, assignFrom_default;
var init_assignFrom = __esm({
  "../assign-gingerly/assignFrom.js"() {
    init_getValues();
    init_assignGingerly();
    init_resolveIdRef();
    init_inferredAssignments();
    init_resolveLhsPath();
    init_registry();
    init_snippets();
    SUBSTITUTION_VARS = [
      { placeholder: "${x}", optionKey: "where_x_in" },
      { placeholder: "${y}", optionKey: "where_y_in" },
      { placeholder: "${z}", optionKey: "where_z_in" }
    ];
    TERNARY_SKIP = /* @__PURE__ */ Symbol("ternary-skip");
    pendingWork = /* @__PURE__ */ new WeakMap();
    assignFrom_default = assignFrom;
  }
});

// o2h.js
init_treeSpec();

// ../assign-gingerly/handlers/compileTree.js
init_getValues();
init_microJoin();
init_treeSpec();
var IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
var ATTR_KEY = /^([A-Za-z_:][\w:.-]*) :=$/;
var SELF_SYNC_OP_KEY = /^(?:\?\.)?(?:textContent)? =&$/;
function classifyPatternKey(key, value2, aka = {}) {
  if (IDENTIFIER.test(key)) {
    const name = aka[key] ?? key;
    if (name === "textContent")
      return { kind: "text" };
    if (name === "ish")
      return { kind: "ish" };
    return IDENTIFIER.test(name) ? { kind: "property", name } : { kind: "other" };
  }
  const attrMatch = ATTR_KEY.exec(key);
  if (attrMatch)
    return aka[attrMatch[1]] === void 0 ? { kind: "attribute", name: attrMatch[1] } : { kind: "other" };
  if (isEventBinding(key, value2))
    return { kind: "event" };
  if (SELF_SYNC_OP_KEY.test(key))
    return { kind: "syncOp" };
  return { kind: "other" };
}
function attributeText(value2) {
  if (value2 === true)
    return "";
  if (value2 === false || value2 == null)
    return null;
  if (Array.isArray(value2)) {
    const tokens2 = value2.filter((item) => item != null && item !== false).map(String);
    return tokens2.length > 0 ? tokens2.join(" ") : null;
  }
  if (typeof value2 === "string" || typeof value2 === "number" || typeof value2 === "bigint")
    return String(value2);
  return void 0;
}

// o2h.js
init_getValues();
init_microJoin();
init_assignFrom();
var PENDING_ATTRIBUTE = "data-pending";
var PENDING_STYLE = `<style>@media (scripting: enabled) { [${PENDING_ATTRIBUTE}] { visibility: hidden; } }</style>`;
var VOID_TAGS = /* @__PURE__ */ new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
var REFLECTED = {
  className: "class",
  id: "id",
  title: "title",
  lang: "lang",
  dir: "dir",
  slot: "slot",
  role: "role",
  href: "href",
  src: "src",
  alt: "alt",
  name: "name",
  type: "type",
  placeholder: "placeholder",
  htmlFor: "for",
  tabIndex: "tabindex",
  dateTime: "datetime",
  value: "value",
  hidden: true,
  checked: true,
  disabled: true,
  required: true,
  selected: true
};
var BOOLEAN_ATTRS = { readOnly: "readonly" };
var escapeText = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var escapeAttr = (text) => String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
function o2h(config, from, options = {}) {
  const { map, keepNullish = false, aka: treeAka, markerName = "tree" } = config;
  const ctx = {
    aka: { ...options.aka, ...treeAka },
    pipes: options.pipes,
    protocols: options.protocols,
    managers: options.managers ?? {},
    snippets: options.snippets,
    unrendered: []
  };
  let html = options.style ? PENDING_STYLE : "";
  html += `<!--?start name="${escapeAttr(markerName)}"-->`;
  let index = 0;
  for (const { spec, value: value2 } of mapEntries(map, from, keepNullish)) {
    const rendered = renderSpec(spec, value2, [from], [index], ctx);
    html += rendered.html;
    index += rendered.elements;
  }
  html += "<!--?end-->";
  const result = { html, unrendered: ctx.unrendered };
  if (options.embed) {
    const check = options.embed === true || options.embed.check !== false;
    const notSerializable = [];
    const json = check ? JSON.stringify(from, checkingReplacer(notSerializable)) : stringifyOrExplain(from);
    result.html += `<script type="application/json" data-tree="${escapeAttr(markerName)}">${escapeScriptJson(json ?? "null")}<\/script>`;
    if (check)
      result.notSerializable = notSerializable;
  }
  return result;
}
function escapeScriptJson(json) {
  return json.replace(/</g, "\\u003c");
}
function stringifyOrExplain(from) {
  try {
    return JSON.stringify(from);
  } catch (e) {
    throw new Error(`o2h embed: the data can't be serialized as JSON (${e.message}); embed: true (with the check) finds where`);
  }
}
function checkingReplacer(notSerializable) {
  const paths = /* @__PURE__ */ new WeakMap();
  return function(key, value2) {
    const holderPath = paths.get(this);
    const path = holderPath === void 0 ? "?." : holderPath === "?." ? `?.${key}` : `${holderPath}?.${key}`;
    const original = this[key];
    const type = typeof original;
    if (type === "function" || type === "symbol" || type === "bigint") {
      notSerializable.push({ path, kind: type === "function" ? "a function (dropped)" : `a ${type} (dropped)` });
      return void 0;
    }
    if (type === "number" && !Number.isFinite(original)) {
      notSerializable.push({ path, kind: `${original} (becomes null)` });
    } else if (original !== null && type === "object") {
      const proto = Object.getPrototypeOf(original);
      if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
        const name = proto?.constructor?.name || "an object";
        notSerializable.push({
          path,
          kind: original instanceof Date ? "a Date (becomes an ISO string)" : original instanceof Map || original instanceof Set ? `a ${name} (becomes {})` : `a ${name} instance (its prototype and getters are lost)`
        });
      }
    }
    if (value2 !== null && typeof value2 === "object")
      paths.set(value2, path);
    return value2;
  };
}
var snippetPartsBySource = /* @__PURE__ */ new Map();
function partsOf(source) {
  let parts = snippetPartsBySource.get(source);
  if (!parts)
    snippetPartsBySource.set(source, parts = snippetParts(source));
  return parts;
}
function holeSpecOf(tag, hole) {
  return Array.isArray(hole) ? [tag, ...hole] : [tag, hole];
}
function resolveOptions(stack, ctx) {
  return { pipes: ctx.pipes, aka: ctx.aka, protocols: ctx.protocols, fromStack: stack };
}
function renderSpec(spec, value2, stack, path, ctx, hole) {
  const options = resolveOptions(stack, ctx);
  if (isSwitch(spec)) {
    const { spec: chosen } = chooseCase(spec, value2, (p, v) => getValue(p, v, options));
    if (chosen == null)
      return { html: "<!--?switch-->", elements: 0 };
    return renderSpec(chosen, value2, stack, path, ctx);
  }
  if (isSnippet(spec)) {
    let html2 = "";
    for (const part of partsOf(snippetSource(spec, ctx.snippets))) {
      if (typeof part === "string") {
        html2 += part;
        continue;
      }
      const hole2 = spec.holes?.[part.hole];
      html2 += hole2 === void 0 ? part.open + part.fallback + part.close : renderSpec(holeSpecOf(part.tag, hole2), value2, stack, path, ctx, part).html;
    }
    return { html: html2, elements: 1 };
  }
  const [, tag, ish, pattern = {}, children, repeat, nested] = normalize(spec);
  const attrs = new Map(hole?.attrs);
  let pending = false;
  let content;
  let scope = value2;
  if (ish !== void 0) {
    if (typeof ish !== "string") {
      ctx.unrendered.push({ path, key: "ish (a class can't be named in HTML: register it by name)" });
    } else {
      attrs.set("itemscope", ish);
      pending = true;
      const Manager = ctx.managers[ish];
      if (Manager)
        scope = constructManager(Manager, value2, path, ctx);
    }
  }
  const setProperty = (name, propValue) => {
    if (name === "textContent") {
      content = propValue == null ? "" : escapeText(propValue);
      return;
    }
    const reflected = REFLECTED[name];
    const booleanAttr = reflected === true ? name.toLowerCase() : BOOLEAN_ATTRS[name];
    if (booleanAttr) {
      if (propValue)
        attrs.set(booleanAttr, "");
      else
        attrs.delete(booleanAttr);
    } else if (typeof reflected === "string") {
      if (propValue == null)
        attrs.delete(reflected);
      else
        attrs.set(reflected, String(propValue));
    } else {
      pending = true;
    }
  };
  for (const key of Object.keys(pattern)) {
    const raw = pattern[key];
    const classified = classifyPatternKey(key, raw, ctx.aka);
    switch (classified.kind) {
      case "text":
        setProperty("textContent", resolveRHS(raw, scope, options));
        break;
      case "attribute": {
        const name = classified.name.toLowerCase();
        const text = attributeText(resolveRHS(raw, scope, options));
        if (text == null)
          attrs.delete(name);
        else
          attrs.set(name, text);
        break;
      }
      case "property":
        setProperty(classified.name, resolveRHS(raw, scope, options));
        break;
      case "syncOp":
        if (raw && typeof raw === "object" && "microJoin" in raw) {
          content = renderMicroJoin(raw, scope, options, attrs);
        } else {
          evaluateOther(key, raw, scope, options, setProperty, path, ctx);
        }
        break;
      case "event":
        pending = true;
        break;
      case "ish":
        pending = true;
        break;
      default:
        evaluateOther(key, raw, scope, options, setProperty, path, ctx);
    }
  }
  let inner = "";
  let childIndex = 0;
  const renderChild = (childSpec, childValue, childStack) => {
    const rendered = renderSpec(childSpec, childValue, childStack, [...path, childIndex], ctx);
    inner += rendered.html;
    childIndex += rendered.elements;
  };
  if (repeat) {
    const holderStack = [...stack, scope];
    const itemOptions = resolveOptions(holderStack, ctx);
    const stamp = repeatItems(repeat, scope, (p, v, forItem) => getValue(p, v, forItem && repeat.of !== void 0 && repeat.of !== "?." ? itemOptions : options));
    const itemStack = stamp.pushesHolder ? holderStack : stack;
    for (const item of stamp.items)
      renderChild(repeat.each, item, itemStack);
    if (stamp.empty !== void 0)
      renderChild(stamp.empty, scope, stack);
  } else if (nested) {
    inner += `<!--?start name="${escapeAttr(nested.markerName ?? "tree")}"-->`;
    for (const entry of mapEntries(nested.map, scope, nested.keepNullish)) {
      renderChild(entry.spec, entry.value, [...stack, scope]);
    }
    inner += "<!--?end-->";
  } else {
    for (const childSpec of children)
      renderChild(childSpec, scope, stack);
  }
  if (pending)
    attrs.set(PENDING_ATTRIBUTE, "");
  let html = `<${tag}`;
  for (const [name, text] of attrs)
    html += text === "" ? ` ${name}` : ` ${name}="${escapeAttr(text)}"`;
  html += ">";
  if (VOID_TAGS.has(tag))
    return { html, elements: 1 };
  if (hole && content === void 0 && children.length === 0 && !repeat && !nested)
    content = hole.fallback;
  return { html: html + (content ?? "") + inner + `</${tag}>`, elements: 1 };
}
function constructManager(Manager, value2, path, ctx) {
  const managerCtx = { rebind() {
  } };
  try {
    if (typeof Manager.onAssigned !== "function")
      return new Manager(null, Object.assign({}, value2), managerCtx);
    const instance = new Manager(null, void 0, managerCtx);
    const result = Manager.onAssigned(instance, value2, { element: null, initial: true, ...managerCtx });
    if (result && typeof result.then === "function")
      result.then(void 0, () => {
      });
    return instance;
  } catch {
    ctx.unrendered.push({ path, key: "ish (the manager threw on the server; its subtree renders from the raw value)" });
    return value2;
  }
}
function resolveRHS(raw, scope, options) {
  return getValues({ value: raw }, scope, options).value;
}
function evaluateOther(key, raw, scope, options, setProperty, path, ctx) {
  const scratch = {};
  try {
    assignFrom(scratch, { [key]: raw }, { ...options, from: scope });
  } catch {
    ctx.unrendered.push({ path, key });
    return;
  }
  const names = Object.keys(scratch);
  if (names.length === 0)
    ctx.unrendered.push({ path, key });
  for (const name of names)
    setProperty(name, scratch[name]);
}
function renderMicroJoin(config, scope, options, attrs) {
  const { microJoin: args } = getValues(config, scope, options);
  const { items, shapes } = planMicroJoin(args, config.microJoin, options.protocols);
  if (!attrs.has("itemscope") && items.some((item) => typeof item !== "string" && item.prop !== void 0))
    attrs.set("itemscope", "");
  let html = "";
  items.forEach((item, i) => {
    if (typeof item === "string") {
      html += escapeText(item);
      return;
    }
    const { tag, attr, attrValue, text } = shapes[i];
    html += `<${tag}`;
    if (item.prop !== void 0)
      html += ` itemprop="${escapeAttr(item.prop)}"`;
    if (attr)
      html += ` ${attr}="${escapeAttr(attrValue)}"`;
    html += `>${text ? escapeText(text) : ""}</${tag}>`;
  });
  return html;
}

// worker/core.js
var O2H_HEADER = "X-O2H-Config";
var O2H_ERROR_HEADER = "X-O2H-Error";
function isO2HRequest(request) {
  return request.headers.has(O2H_HEADER);
}
async function handleO2HRequest(request, lookup, fetchUpstream = fetch) {
  const key = request.headers.get(O2H_HEADER);
  const headers = new Headers(request.headers);
  headers.delete(O2H_HEADER);
  const upstream = await fetchUpstream(new Request(request, { headers }));
  if (!upstream.ok || !isJson(upstream.headers.get("Content-Type")))
    return upstream;
  let record;
  try {
    record = await lookup(key);
  } catch (e) {
    return withError(upstream, `the record "${key}" couldn't be read (${e.message})`);
  }
  if (!record?.config)
    return withError(upstream, `no record for "${key}"`);
  let html;
  try {
    const data = await upstream.clone().json();
    const { options = {} } = record;
    html = o2h(record.config, data, { ...options, embed: options.embed || true }).html;
  } catch (e) {
    return withError(upstream, `rendering failed (${e.message})`);
  }
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("Content-Length");
  responseHeaders.delete("Content-Encoding");
  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  responseHeaders.append("Vary", O2H_HEADER);
  return new Response(html, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}
function isJson(contentType) {
  const type = contentType?.split(";")[0].trim().toLowerCase() ?? "";
  return type === "application/json" || type.endsWith("+json");
}
function withError(upstream, message) {
  const headers = new Headers(upstream.headers);
  headers.append("Vary", O2H_HEADER);
  headers.set(O2H_ERROR_HEADER, message.replace(/[^\x20-\x7e]/g, "?").slice(0, 300));
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

// worker/store.js
var DB = "o2h";
var STORE = "records";
function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function run(mode, use) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = use(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
function getO2HRecord(key) {
  return run("readonly", (store) => store.get(key));
}

// worker/serviceWorker.ts
var sw = self;
sw.addEventListener("install", (event) => event.waitUntil(sw.skipWaiting()));
sw.addEventListener("activate", (event) => event.waitUntil(sw.clients.claim()));
sw.addEventListener("fetch", (event) => {
  if (isO2HRequest(event.request)) event.respondWith(handleO2HRequest(event.request, getO2HRecord));
});
