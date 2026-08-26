/**
 * Centralized utilities for parsing slash commands
 */

export type ParsedSlashCommand = {
  commandName: string
  args: string
  isOcadeTools: boolean
}

/**
 * Parses a slash command input string into its component parts
 *
 * @param input - The raw input string (should start with '/')
 * @returns Parsed command name, args, and OCADETools flag, or null if invalid
 *
 * @example
 * parseSlashCommand('/search foo bar')
 * // => { commandName: 'search', args: 'foo bar', isOcadeTools: false }
 *
 * @example
 * parseSlashCommand('/ocadeTools:tool (OCADETools) arg1 arg2')
 * // => { commandName: 'ocadeTools:tool (OCADETools)', args: 'arg1 arg2', isOcadeTools: true }
 */
export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  const trimmedInput = input.trim()

  // Check if input starts with '/'
  if (!trimmedInput.startsWith('/')) {
    return null
  }

  // Remove the leading '/' and split by spaces
  const withoutSlash = trimmedInput.slice(1)
  const words = withoutSlash.split(' ')

  if (!words[0]) {
    return null
  }

  let commandName = words[0]
  let isOcadeTools = false
  let argsStartIndex = 1

  // Check for OCADETools commands (second word is '(OCADETools)')
  if (words.length > 1 && words[1] === '(OCADETools)') {
    commandName = commandName + ' (OCADETools)'
    isOcadeTools = true
    argsStartIndex = 2
  }

  // Extract arguments (everything after command name)
  const args = words.slice(argsStartIndex).join(' ')

  return {
    commandName,
    args,
    isOcadeTools,
  }
}

