/** Keep Discord's portal-created Activity launch command during slash registration. */
export function entryPointCommands(
  existing: {
    type: number;
    name: string;
    description?: string;
    handler?: number;
    integration_types?: number[];
    contexts?: number[];
  }[],
) {
  return existing
    .filter((command) => command.type === 4)
    .map((command) => ({
      type: 4,
      name: command.name,
      description: command.description ?? "Activity starten",
      ...(command.handler !== undefined ? { handler: command.handler } : {}),
      ...(command.integration_types
        ? { integration_types: command.integration_types }
        : {}),
      ...(command.contexts ? { contexts: command.contexts } : {}),
    }));
}
