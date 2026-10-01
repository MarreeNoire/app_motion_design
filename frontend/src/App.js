import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MotionStudio from "@/pages/MotionStudio";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MotionStudio />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
