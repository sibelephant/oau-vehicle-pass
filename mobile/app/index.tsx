// The auth guard in app/_layout.tsx owns this route; it only needs to render
// something while the session loads.
export default function Index() {
  return null;
}
