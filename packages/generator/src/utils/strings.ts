export const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1)

export function toCamelCase(str: string) {
  if (!str) return str
  return str
    .split('_')
    .map((part, i) => i === 0 ? part.toLowerCase() : capitalize(part))
    .join('')
}