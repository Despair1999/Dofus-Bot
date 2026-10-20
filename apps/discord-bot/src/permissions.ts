/** The backend currently has one owner. Discord IDs never become backend owners implicitly. */
export function canAccess(
  command: string,
  subcommand: string | undefined,
  userId: string,
  ownerId: string,
): boolean {
  if (command === "charakter" || command === "builder")
    return userId === ownerId;
  if (command === "quest" && subcommand !== "suchen" && subcommand !== "info")
    return userId === ownerId;
  return true;
}
