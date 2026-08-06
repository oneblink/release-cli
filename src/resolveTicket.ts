import enquirer from 'enquirer'

export const TICKET_PATTERN = /^[a-z]{1,3}-\d+$/i

const TICKET_VALIDATION_MESSAGE =
  'Ticket must be 1-3 alpha characters, then a hyphen followed by a number'

export default async function resolveTicket({
  ticketFlag,
  force = false,
}: {
  ticketFlag: string | undefined
  force?: boolean
}): Promise<string> {
  if (ticketFlag) {
    if (!TICKET_PATTERN.test(ticketFlag)) {
      throw new Error(TICKET_VALIDATION_MESSAGE)
    }
    return ticketFlag.toUpperCase()
  }

  if (force) {
    throw new Error(
      'Cannot use "--force" without "--ticket" because all prompts are skipped.',
    )
  }

  const { ticket } = await enquirer.prompt<{
    ticket: string
  }>({
    type: 'input',
    name: 'ticket',
    message: `Ticket to associate with pull requests? (e.g. ON-4323, AP-4323, MS-4323)`,
    required: true,
    validate: (input) => {
      if (!TICKET_PATTERN.test(input)) {
        return TICKET_VALIDATION_MESSAGE
      }
      return true
    },
    result: (input) => input.toUpperCase(),
  })

  return ticket
}
