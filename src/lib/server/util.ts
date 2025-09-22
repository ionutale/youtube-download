export function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 120);
}
