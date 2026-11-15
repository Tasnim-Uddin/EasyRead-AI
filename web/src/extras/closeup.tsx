import { CloseUp, hasCloseUp } from "../closeups";

/** The close-up for an id from the library (web/src/closeups), or nothing. */
export function CloseUpPic({ id, playing = false }: { id: string | null | undefined; playing?: boolean }) {
  if (!id || !hasCloseUp(id)) return null;
  return <CloseUp id={id} playing={playing} />;
}
export { hasCloseUp };
