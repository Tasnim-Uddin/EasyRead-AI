// Placeholder until the close-up library lands (same exports, no close-ups yet).
export function hasCloseUp(_id: string): boolean {
  return false;
}

export function CloseUp({ id }: { id: string; playing: boolean }) {
  return <div className="closeup-missing" data-closeup={id} />;
}
