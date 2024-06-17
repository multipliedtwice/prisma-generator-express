export const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1)

export function toPascalCase(str: string) {
  if (!str) return str
  return str.charAt(0).toLowerCase() + str.slice(1)
}
