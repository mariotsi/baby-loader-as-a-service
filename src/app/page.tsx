import Link from 'next/link';

export default function MarketingPage() {
  return (
    <div className="container">
      <div className="site-hero">
        <p className="site-tagline">Waiting Pages</p>
        <h1 className="site-title">A page for the wait, made yours</h1>
        <p className="muted">
          Create a customizable countdown &amp; announcement page for your baby — pick your colors, your font,
          what to show, and share it on your own link.
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
          <Link className="btn" href="/signup">
            Create your page
          </Link>
          <Link className="btn-secondary" href="/login">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
