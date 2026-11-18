export const PASSWORD_RULES = [
  { label: 'At least 8 characters',       test: (p: string) => p.length >= 8 },
  { label: 'At least 1 capital letter',   test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least 1 lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'At least 1 number',           test: (p: string) => /[0-9]/.test(p) },
]

export const passwordValid = (p: string) => PASSWORD_RULES.every(r => r.test(p))
