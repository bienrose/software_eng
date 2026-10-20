export function validateSchemaValue(dataType: string, value: unknown, options: unknown[] = []) {
  if (typeof value === "string" && value.trim() === "") return { valid: true, value: "" } as const;

  if (dataType === "text") {
    if (typeof value !== "string") return { valid: false } as const;
    return { valid: true, value: value.slice(0, 10000) } as const;
  }
  if (dataType === "integer" || dataType === "decimal") {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || (dataType === "integer" && !Number.isInteger(parsed))) return { valid: false } as const;
    return { valid: true, value: parsed } as const;
  }
  if (dataType === "boolean") {
    if (value === true || value === "true") return { valid: true, value: true } as const;
    if (value === false || value === "false") return { valid: true, value: false } as const;
    return { valid: false } as const;
  }
  if (dataType === "date") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return { valid: false } as const;
    return { valid: true, value } as const;
  }
  if (dataType === "datetime") {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return { valid: false } as const;
    return { valid: true, value } as const;
  }
  if (dataType === "enum") {
    if (typeof value !== "string") return { valid: false } as const;
    if (options.length > 0 && !options.includes(value)) return { valid: false } as const;
    return { valid: true, value: value.slice(0, 500) } as const;
  }
  return { valid: false } as const;
}
