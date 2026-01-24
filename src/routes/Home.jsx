import { Link } from 'react-router-dom';

export default function Home() {
    return (
        <div className="home-hero">
            <h1>Block Radius</h1>
            <p>
                Discover exclusive music releases with full album access,
                smart bridge playback, and high-quality MP3 downloads.
            </p>
            <div style={{ marginTop: '32px' }}>
                <Link to="/shop" className="buy-button" style={{ display: 'inline-block', textDecoration: 'none' }}>
                    Browse Shop
                </Link>
            </div>
        </div>
    );
}