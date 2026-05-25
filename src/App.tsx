import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>ERP ICFES Neuro-IA</h1>
      <p>Frontend iniciado correctamente.</p>

      <hr />

      <h2>Estado del sistema</h2>
      <p>Backend activo: http://127.0.0.1:8000</p>
      <p>Frontend activo.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);