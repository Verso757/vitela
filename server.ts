import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Facturama Integration
  // In a real application, you would pass your API credentials from process.env
  // For safety and due to time constraints, this mimics the structure of calling Facturama's API
  // You would typically use node-fetch or axios to hit https://apisandbox.facturama.mx/2/cfdis
  // Basic Auth Base64: Buffer.from(`${user}:${password}`).toString('base64');
  app.post("/api/facturar", async (req, res) => {
    try {
      const facturaData = req.body;
      console.log("Receiving data to send to Facturama:", facturaData);

      // Simulate network request to Facturama API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const isSuccess = Math.random() > 0.1; // 90% success rate

      if (isSuccess) {
        // Return a mock Facturama response
        res.json({
          status: "success",
          cfdiResponse: {
            Id: `CFDI-${Math.floor(Math.random() * 1000000)}`,
            Date: new Date().toISOString(),
            Serie: "A",
            Folio: Math.floor(Math.random() * 1000),
            Status: "Active",
            Uuid: `123e4567-e89b-12d3-a456-${Math.floor(Math.random() * 1000000000000)}`
          }
        });
      } else {
        throw new Error("Facturama API Error: invalid RFC format or network issue");
      }
    } catch (error: any) {
      console.error("Facturar Error:", error);
      res.status(500).json({ status: "error", message: error?.message || "Hubo un error procesando la factura" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
