import React from "react";
import { Link } from "react-router-dom";

// Use real publish shareIds (NOT legacy project keys)
const ITEMS = [
  { shareId: "40aecb74517369bdc6a2353e", title: "post programmer", artist: "joel 190" }
  // Add more shareIds here as you publish them
];

export default function Shop() {
  return (
    <div>
      <h1>Shop</h1>
      <div className="grid">
        {ITEMS.map((it) => (
          <Link key={it.shareId} className="card" to={`/product/${it.shareId}`}>
            <div className="thumb" />
            <div className="cardBody">
              <div className="cardTitle">{it.title}</div>
              <div className="cardSub">{it.artist}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
