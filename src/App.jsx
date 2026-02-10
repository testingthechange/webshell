// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./routes/Home.jsx";
import Shop from "./routes/Shop.jsx";
import Product from "./routes/Product.jsx";
import Account from "./routes/Account.jsx";
import Checkout from "./routes/Checkout.jsx";
import FakeCheckout from "./routes/FakeCheckout.jsx";
import Header from "./components/Header.jsx";

export default function App() {
  return (
    <div>
      <Header />

      <Routes>
        <Route path="/" element={<Home />} />

        {/* Swapped ordering so Account appears before Shop in the main nav (Header uses route order) */}
        <Route path="/account" element={<Account />} />
        <Route path="/account/:shareId" element={<Account />} />

        <Route path="/shop" element={<Shop />} />

        <Route path="/product/:shareId" element={<Product />} />
        <Route path="/checkout/:shareId" element={<Checkout />} />
        <Route path="/fake-checkout/:shareId" element={<FakeCheckout />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
