import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./routes/Home.jsx";
import Shop from "./routes/Shop.jsx";
import Product from "./routes/Product.jsx";
import Account from "./routes/Account.jsx";
import AccountIndex from "./routes/AccountIndex.jsx";
import Checkout from "./routes/Checkout.jsx";
import FakeCheckout from "./routes/FakeCheckout.jsx";
import Header from "./components/Header.jsx";

export default function App() {
  return (
    <div>
      <Header />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />

        <Route path="/product/:shareId" element={<Product />} />
        <Route path="/checkout/:shareId" element={<Checkout />} />
        <Route path="/fake-checkout/:shareId" element={<FakeCheckout />} />

        {/* ✅ account: allow /account with redirect to last purchase */}
        <Route path="/account" element={<AccountIndex />} />
        <Route path="/account/:shareId" element={<Account />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
