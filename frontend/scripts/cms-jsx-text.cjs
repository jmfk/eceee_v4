const normalizeJsxText = (value) => {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  const words = lines.map((original, index) => {
    let line = original.replace(/\t/g, ' ')
    if (index !== 0) line = line.replace(/^ +/, '')
    if (index !== lines.length - 1) line = line.replace(/ +$/, '')
    return line
  }).filter(Boolean)
  return words.join(' ')
}

const isTranslatable = (text) => /[A-Za-z]{2}/.test(text)
  && !/&(?:#\d+|[A-Za-z]+);/.test(text)
  && !/https?:\/\/|[{}<>`]/.test(text)
  && !/^[.#@]/.test(text)

module.exports = { normalizeJsxText, isTranslatable }
