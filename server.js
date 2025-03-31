const express = require("express");
const cors = require("cors");
const path = require("path");
const api = require("./api");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

//CORS
app.use(
    cors({
        origin: "http://localhost:5173", // Adjust this to match your frontend URL
        methods: "GET,POST,PUT,DELETE",
        credentials: true, // Allow cookies and authorization headers
    })
)

// Serve static React files
app.use(express.static(path.join(__dirname, "dist")));


app.use("/api", api);

app.get("/*splat", (req, res) => {
  return res.sendFile(path.join(__dirname, "dist", "index.html"));
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});