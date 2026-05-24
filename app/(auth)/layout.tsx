// Full-bleed wrapper for /signin (and any future (auth) routes). Opts out of
// the centered-card chrome inherited from the root layout so the two-pane
// marketing/form split can fill the viewport.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen w-full">{children}</div>;
}
