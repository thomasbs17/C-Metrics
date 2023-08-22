import React from 'react';
import NavBar from './components/Navbar';
import 'bootstrap/dist/css/bootstrap.min.css';
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from './pages/Home';
import Trading from './pages/Trading';
import Portfolio from './pages/Portfolio';
import NoPage from './pages/NoPage';
import UserRegistrationForm from './pages/User';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  return (
    <div className="App">
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <BrowserRouter>
          <NavBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trading" element={<Trading />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="/registration" element={<UserRegistrationForm />} />
            <Route path="*" element={<NoPage />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </div>
  );
}

export default App;
