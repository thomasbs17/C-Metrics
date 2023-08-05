import React from 'react';
import './App.css';
import NavBar from './components/Navbar';
import 'bootstrap/dist/css/bootstrap.min.css';
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from './pages/Home';
import Trading from './pages/Trading';
import Portfolio from './pages/Portfolio';
import NoPage from './pages/NoPage';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <NavBar />
        <Routes>
        <Route path="/" element={<Home />} />
          <Route path="/trading" element={<Trading />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="*" element={<NoPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
