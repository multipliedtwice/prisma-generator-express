export function generateParseQueryParams() {
  return `/**
    * Type guard to check if a value is an object.
    * @param {unknown} value - The value to check.
    * @returns {boolean} True if the value is an object, false otherwise.
    */
  const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
  };
  
  /**
    * Parses a query value to convert strings to their respective types.
    * @param {string} value - The query value to parse.
    * @returns {any} The parsed value.
    */
  const parseQueryValue = (value: string): unknown => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (!isNaN(Number(value))) return Number(value);
    return value;
  };
  
  /**
    * Recursively parses query parameters to convert strings to their respective types.
    * @param {unknown} params - The query parameters to parse.
    * @returns {unknown} The parsed query parameters.
    */
  export const parseQueryParams = (params: unknown): unknown => {
    if (typeof params === "string") {
      return parseQueryValue(params);
    }
    if (Array.isArray(params)) {
      return params.map(parseQueryParams);
    }
    if (isObject(params)) {
      const parsedParams: Record<string, unknown> = {};
      for (const key in params) {
        parsedParams[key] = parseQueryParams(params[key]);
      }
      return parsedParams;
    }
    return params;
  };`
}
