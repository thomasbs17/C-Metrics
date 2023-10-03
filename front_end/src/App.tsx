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
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: "#6b6b6b #2b2b2b",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            backgroundColor: "#2b2b2b",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: "#6b6b6b",
            minHeight: 24,
            border: "3px solid #2b2b2b",
          },
          "&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus": {
            backgroundColor: "#959595",
          },
          "&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active": {
            backgroundColor: "#959595",
          },
          "&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover": {
            backgroundColor: "#959595",
          },
          "&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner": {
            backgroundColor: "#2b2b2b",
          }
        }
      }
    }
  },
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
